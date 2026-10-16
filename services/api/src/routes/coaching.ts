import type { Context, Hono } from 'hono';
import { DomainError, isApprovedRegion } from '@potenova/contracts';
import {
  assertMasteryPolicyApproved,
  MIN_TRUSTED_RECOGNITION,
  type MasteryEvidence,
  type SkillProjection,
  type EvidenceMode,
  type AssistanceBand,
} from '@potenova/learner-state';
import { CONSENT_PURPOSES } from '@potenova/identity';
import { decideEscalation, handleDisclosure, type EscalationInput } from '@potenova/safety';
import { completeSession, type SessionState } from '@potenova/planner';
import { readAuth, requireActorType, assertRegion, type AuthCtx } from '../auth';
import { now, type Deps } from '../deps';
import { reconcileUsageOnEnd } from '../usage';
import {
  projectSkill,
  computeNext,
  assessStall,
  sessionBudget,
  hintFor,
  buildSessionSummary,
  reviewDueFor,
  allCoachableMastered,
  courseFor,
  type Subject,
  type CourseId,
} from '../adaptive';
import {
  TASK_BANK,
  TRANSFER_TASKS,
  RELEASE_BY_SUBJECT,
  present,
  tokenValid,
  judge,
  representationOf,
  gateTask,
  type Task,
} from '../task-bank';

/**
 * Coaching turn (the heart of the vertical slice).
 *
 *  - Task delivery runs the content gate: a task's answer key is validated by the
 *    independent math oracle before it reaches the child (AI-001; nothing
 *    unvalidated delivered).
 *  - An answer is graded by the deterministic oracle, written as IMMUTABLE
 *    evidence, and mastery is re-derived from the ledger (never hand-set), behind
 *    the ER-03 approval gate.
 *  - A flagged sensitive disclosure diverts to the escalation matrix (ER-08)
 *    instead of grading — fail-closed to max containment while the matrix is
 *    unconfigured.
 *  - `/next` asks the PLANNER which skill to coach next, reading derived mastery
 *    against the review-controlled curriculum graph (adaptive + remediation);
 *    selection only reads mastery, it can never set it.
 *
 * Synthetic task bank only — no model generation on this path yet. Skill ids are
 * the CANONICAL curriculum ids so evidence, the graph and the planner all agree.
 */

async function requireActiveSession(
  deps: Deps,
  sessionId: string,
  alias: string,
): Promise<{ subject: Subject; course: CourseId }> {
  const row = await deps.session.getTutoringSession(sessionId);
  if (!row || row.learnerAlias !== alias) throw new DomainError('NOT_FOUND', 'session not found');
  if (row.state !== 'ACTIVE') throw new DomainError('POLICY_BLOCKED', 'session is not active');
  const subject = row.subject as Subject;
  // The strand/course the session actually runs (persisted at start; default by subject).
  return { subject, course: courseFor(subject, row.strand) };
}

/** End a session cleanly as COMPLETED (e.g. the ER-09 item budget was reached). */
async function endSessionComplete(deps: Deps, sessionId: string): Promise<void> {
  const row = await deps.session.getTutoringSession(sessionId);
  if (!row || row.state !== 'ACTIVE') return;
  const completed = completeSession({
    sessionId: row.sessionId,
    learnerAlias: row.learnerAlias,
    subject: row.subject as Subject,
    state: row.state as SessionState,
  });
  // Refund the unused reservation before flipping state (reconciles once).
  await reconcileUsageOnEnd(deps, row);
  await deps.session.saveTutoringSession({ ...row, state: completed.state });
}

/** Grade an answer, write immutable evidence (ER-03 gated) and re-derive mastery. */
async function gradeAndRecord(
  deps: Deps,
  args: {
    alias: string;
    sessionId: string;
    clientSubmissionId: string;
    task: Task;
    answer: string;
    representation: string;
    recognitionConfidence: number;
    /** Review turns are tagged retention_check / A1 so a delayed retrieval
     *  resolves RETAINED; normal turns are independent_check / A0. */
    mode?: EvidenceMode;
    assistanceBand?: AssistanceBand;
  },
): Promise<{ correct: boolean; skillId: string; evidenceId: string; projection: SkillProjection }> {
  const correct = judge(args.task, args.answer);
  assertMasteryPolicyApproved(deps.policies.mastery, deps.policies.isProd);
  const evidence: MasteryEvidence = {
    eventId: `${args.sessionId}:${args.clientSubmissionId}`,
    learnerAlias: args.alias,
    skillId: args.task.skillId,
    mode: args.mode ?? 'independent_check',
    assistanceBand: args.assistanceBand ?? 'A0',
    correct,
    representation: args.representation,
    recognitionConfidence: args.recognitionConfidence,
    observedAt: now(),
    curriculumReleaseId: RELEASE_BY_SUBJECT[args.task.subject],
    schemaVersion: 'evt-0.1',
  };
  await deps.evidence.appendEvidence(evidence);
  const projection = await projectSkill(deps, args.alias, args.task.skillId);
  return { correct, skillId: args.task.skillId, evidenceId: evidence.eventId, projection };
}

interface AnswerBody {
  clientSubmissionId?: string;
  taskId?: string;
  answer?: string;
  /** Representation the learner worked in (AT-10). Defaults to 'symbolic'. */
  representation?: string;
  /** Upstream safety-classifier output for a sensitive disclosure (SAFE-016). */
  disclosure?: EscalationInput;
}

interface MultimodalBody {
  clientSubmissionId?: string;
  taskId?: string;
  modality?: string;
  mediaRef?: string;
}

export function registerCoaching(app: Hono, deps: Deps): void {
  const authed = (c: Context): AuthCtx => {
    const a = readAuth(c, deps.config.primaryRegion);
    assertRegion(a);
    return a;
  };

  // Adaptive next-objective selection: the planner reads derived mastery against
  // the canonical graph and picks the next skill (remediation vs advancement).
  app.get('/learners/:alias/sessions/:sessionId/next', async (c) => {
    const a = authed(c);
    requireActorType(a, 'child');
    const alias = c.req.param('alias');
    const sessionId = c.req.param('sessionId');
    const { course } = await requireActiveSession(deps, sessionId, alias);
    const next = await computeNext(deps, alias, course, { sessionId });
    const budget = await sessionBudget(deps, alias, sessionId);
    return c.json({ ...next, budget });
  });

  // Deliver a validated task — content gate on the delivery path (AI-001).
  app.post('/learners/:alias/sessions/:sessionId/task', async (c) => {
    const a = authed(c);
    requireActorType(a, 'child');
    const alias = c.req.param('alias');
    const { course } = await requireActiveSession(deps, c.req.param('sessionId'), alias);

    const taskId = c.req.query('taskId') ?? 'frac-cmp-1';
    const task = TASK_BANK[taskId];
    if (!task) throw new DomainError('NOT_FOUND', 'task not found');
    if (task.course !== course) {
      throw new DomainError('POLICY_BLOCKED', 'task is not for this session course');
    }

    // Content gate: the answer key is validated by the subject's INDEPENDENT
    // oracle before delivery (AI-001). Throws POLICY_BLOCKED if it fails.
    gateTask(taskId);

    const { question, options } = present(task);
    return c.json({ taskId, skillId: task.skillId, question, options });
  });

  // Submit an answer → evidence → mastery (ER-03 gated); or divert to escalation.
  app.post('/learners/:alias/sessions/:sessionId/answer', async (c) => {
    const a = authed(c);
    requireActorType(a, 'child');
    const alias = c.req.param('alias');
    const sessionId = c.req.param('sessionId');
    const { course } = await requireActiveSession(deps, sessionId, alias);

    const b = await c.req.json<AnswerBody>().catch(() => ({}) as AnswerBody);
    if (!b.clientSubmissionId) {
      throw new DomainError('POLICY_BLOCKED', 'clientSubmissionId is required');
    }

    // At-most-once (AT-27): a retried submission produces no second evidence event.
    const sub = await deps.session.recordSubmission(b.clientSubmissionId, now());
    if (!sub.accepted) return c.json({ duplicate: true });

    // A flagged sensitive disclosure diverts to the escalation matrix (ER-08) and
    // is NOT graded as a normal turn (SAFE-016).
    if (b.disclosure) {
      const handling = handleDisclosure('sensitive');
      const escalation = decideEscalation(deps.policies.escalation, b.disclosure, {
        available: true,
        requireApproved: deps.policies.isProd,
      });
      return c.json({ graded: false, safety: { handling, ...escalation } });
    }

    const task = TASK_BANK[b.taskId ?? ''];
    if (!task) throw new DomainError('NOT_FOUND', 'task not found');
    if (task.course !== course) {
      throw new DomainError('POLICY_BLOCKED', 'task is not for this session course');
    }
    if (typeof b.answer !== 'string' || !tokenValid(task, b.answer)) {
      throw new DomainError('POLICY_BLOCKED', 'answer is not valid for this task');
    }

    // Session item budget (ER-09): never grade past the item ceiling, and don't
    // introduce a new concept beyond the per-session cap (learner-protection).
    const preBudget = await sessionBudget(deps, alias, sessionId, task.skillId);
    if (preBudget.itemCeilingReached) {
      await endSessionComplete(deps, sessionId);
      return c.json({ graded: false, action: 'SESSION_COMPLETE', budget: preBudget });
    }
    if (preBudget.newConceptBlocked) {
      return c.json({ graded: false, action: 'CONCEPT_BUDGET_REACHED', budget: preBudget });
    }

    // Turn mode: a review turn resolves RETAINED; a transfer task resolves
    // TRANSFERABLE; otherwise a normal independent check.
    const review = await reviewDueFor(deps, alias, task.skillId);
    const isTransfer = TRANSFER_TASKS.has(b.taskId ?? '');
    const graded = await gradeAndRecord(deps, {
      alias,
      sessionId,
      clientSubmissionId: b.clientSubmissionId,
      task,
      answer: b.answer,
      representation: representationOf(task, b.representation),
      recognitionConfidence: 1,
      mode: review ? 'retention_check' : isTransfer ? 'transfer_check' : 'independent_check',
      assistanceBand: review ? 'A1' : 'A0',
    });

    // A session ends cleanly (COMPLETED) with a wrap-up summary when either the
    // ER-09 item ceiling is reached OR every coachable skill is mastered.
    const postBudget = await sessionBudget(deps, alias, sessionId);
    const completionReason = postBudget.itemCeilingReached
      ? 'ITEM_BUDGET'
      : (await allCoachableMastered(deps, alias, course))
        ? 'MASTERY_COMPLETE'
        : null;
    if (completionReason) {
      await endSessionComplete(deps, sessionId);
      const summary = await buildSessionSummary(deps, alias, sessionId);
      return c.json(
        {
          graded: true,
          ...graded,
          budget: postBudget,
          sessionComplete: true,
          completionReason,
          summary,
          ...(review ? { reviewed: true } : {}),
        },
        201,
      );
    }

    // Self-driving loop: the planner recommends the next objective off the freshly
    // re-derived mastery (advancement once the prerequisite is independent); the
    // served practice item rotates with prior in-session attempts.
    const next = await computeNext(deps, alias, course, { sessionId });
    // Coaching ladder on a wrong answer: a targeted HINT first (early wrong), then
    // a stall-driven strategy change (AT-08) once the learner keeps missing.
    const coaching = graded.correct
      ? null
      : await assessStall(deps, alias, sessionId, task.skillId, course);
    const hint = !graded.correct && !coaching ? hintFor(course, task.skillId) : null;
    return c.json(
      {
        graded: true,
        ...graded,
        next,
        budget: postBudget,
        ...(review ? { reviewed: true } : {}),
        ...(coaching ? { coaching } : {}),
        ...(hint ? { hint } : {}),
      },
      201,
    );
  });

  // Multimodal answer (voice / vision). Requires the per-modality consent grant,
  // runs recognition in a Canadian region, and applies the AT-28 trust floor: a
  // low-confidence reading is never graded — it asks for clarification.
  app.post('/learners/:alias/sessions/:sessionId/answer/multimodal', async (c) => {
    const a = authed(c);
    requireActorType(a, 'child');
    const alias = c.req.param('alias');
    const sessionId = c.req.param('sessionId');
    const { course } = await requireActiveSession(deps, sessionId, alias);

    const b = await c.req.json<MultimodalBody>().catch(() => ({}) as MultimodalBody);
    if (!b.clientSubmissionId) {
      throw new DomainError('POLICY_BLOCKED', 'clientSubmissionId is required');
    }
    if (b.modality !== 'voice' && b.modality !== 'vision') {
      throw new DomainError('POLICY_BLOCKED', "modality must be 'voice' or 'vision'");
    }

    // Per-modality consent: the purpose that owns this modality must be GIVEN.
    const purpose = CONSENT_PURPOSES.find((d) => d.modality === b.modality)?.id;
    const grants = a.actor.familyAlias
      ? await deps.identity.listConsentGrants(a.actor.familyAlias)
      : [];
    const consented = !!purpose && grants.some((g) => g.purpose === purpose && g.state === 'GIVEN');
    if (!consented) {
      throw new DomainError('CONSENT_REQUIRED', `no active ${b.modality} consent`);
    }

    const provider = deps.ai.inputProvider;
    if (!provider) throw new DomainError('DEPENDENCY_UNAVAILABLE', 'no input provider configured');

    const sub = await deps.session.recordSubmission(b.clientSubmissionId, now());
    if (!sub.accepted) return c.json({ duplicate: true });

    const rec =
      b.modality === 'voice'
        ? await provider.transcribe({ audioRef: b.mediaRef ?? '', synthetic: true })
        : await provider.extractText({ imageRef: b.mediaRef ?? '', synthetic: true });

    // Residency: recognition must run in an approved Canadian region.
    if (!isApprovedRegion(rec.region)) {
      throw new DomainError('REGION_DISALLOWED', 'recognition ran outside the Canadian region');
    }

    const task = TASK_BANK[b.taskId ?? ''];
    if (!task) throw new DomainError('NOT_FOUND', 'task not found');
    if (task.course !== course) {
      throw new DomainError('POLICY_BLOCKED', 'task is not for this session course');
    }

    // AT-28: below the trust floor, or an unreadable token, ask for clarification —
    // never grade.
    if (rec.confidence < MIN_TRUSTED_RECOGNITION || !tokenValid(task, rec.text)) {
      return c.json({
        graded: false,
        action: 'REQUEST_CLARIFICATION',
        modality: b.modality,
        recognitionConfidence: rec.confidence,
      });
    }

    // Session item budget (ER-09).
    const preBudget = await sessionBudget(deps, alias, sessionId, task.skillId);
    if (preBudget.itemCeilingReached) {
      await endSessionComplete(deps, sessionId);
      return c.json({ graded: false, action: 'SESSION_COMPLETE', budget: preBudget });
    }
    if (preBudget.newConceptBlocked) {
      return c.json({ graded: false, action: 'CONCEPT_BUDGET_REACHED', budget: preBudget });
    }

    const review = await reviewDueFor(deps, alias, task.skillId);
    const isTransfer = TRANSFER_TASKS.has(b.taskId ?? '');
    const graded = await gradeAndRecord(deps, {
      alias,
      sessionId,
      clientSubmissionId: b.clientSubmissionId,
      task,
      answer: rec.text,
      representation: representationOf(task, undefined),
      recognitionConfidence: rec.confidence,
      mode: review ? 'retention_check' : isTransfer ? 'transfer_check' : 'independent_check',
      assistanceBand: review ? 'A1' : 'A0',
    });

    const postBudget = await sessionBudget(deps, alias, sessionId);
    const completionReason = postBudget.itemCeilingReached
      ? 'ITEM_BUDGET'
      : (await allCoachableMastered(deps, alias, course))
        ? 'MASTERY_COMPLETE'
        : null;
    if (completionReason) {
      await endSessionComplete(deps, sessionId);
      const summary = await buildSessionSummary(deps, alias, sessionId);
      return c.json(
        {
          graded: true,
          modality: b.modality,
          recognitionConfidence: rec.confidence,
          ...graded,
          budget: postBudget,
          sessionComplete: true,
          completionReason,
          summary,
          ...(review ? { reviewed: true } : {}),
        },
        201,
      );
    }

    const next = await computeNext(deps, alias, course, { sessionId });
    const coaching = graded.correct
      ? null
      : await assessStall(deps, alias, sessionId, task.skillId, course);
    const hint = !graded.correct && !coaching ? hintFor(course, task.skillId) : null;
    return c.json(
      {
        graded: true,
        modality: b.modality,
        recognitionConfidence: rec.confidence,
        ...graded,
        next,
        budget: postBudget,
        ...(review ? { reviewed: true } : {}),
        ...(coaching ? { coaching } : {}),
        ...(hint ? { hint } : {}),
      },
      201,
    );
  });
}
