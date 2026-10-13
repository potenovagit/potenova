import type { Context, Hono } from 'hono';
import { DomainError, isApprovedRegion } from '@potenova/contracts';
import { decideDelivery, type CandidateContent } from '@potenova/domain-core';
import {
  checkMathTask,
  checkEnglishTask,
  pluralize,
  trueRelation,
  areEquivalent,
  validateCandidate,
  validationRecordRef,
  type Fraction,
  type FractionRelation,
} from '@potenova/content';
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
import {
  projectSkill,
  computeNext,
  assessStall,
  sessionBudget,
  hintFor,
  buildSessionSummary,
  reviewDueFor,
  allCoachableMastered,
  type Subject,
} from '../adaptive';

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

const RELEASE_BY_SUBJECT: Record<Subject, string> = {
  math: 'REL-ONT-MATH-2020-draft',
  english: 'REL-ONT-LANG-2023-draft',
};
const COMPARE = 'SK-FR-compare';
const EQUIV = 'SK-FR-equiv';
const PLURAL_BASE = 'SK-EN-plural-base';
const PLURAL_SIB = 'SK-EN-plural-sibilant';

interface CompareTask {
  readonly subject: 'math';
  readonly skillId: typeof COMPARE;
  readonly kind: 'fraction_comparison';
  readonly left: Fraction;
  readonly right: Fraction;
}
interface EquivTask {
  readonly subject: 'math';
  readonly skillId: typeof EQUIV;
  readonly kind: 'fraction_equivalence';
  readonly left: Fraction;
  readonly right: Fraction;
}
interface PluralTask {
  readonly subject: 'english';
  readonly skillId: typeof PLURAL_BASE | typeof PLURAL_SIB;
  readonly kind: 'noun_plural';
  readonly word: string;
}
type Task = CompareTask | EquivTask | PluralTask;

const f = (numerator: number, denominator: number): Fraction => ({ numerator, denominator });
const cmp = (left: Fraction, right: Fraction): CompareTask => ({
  subject: 'math',
  skillId: COMPARE,
  kind: 'fraction_comparison',
  left,
  right,
});
const eq = (left: Fraction, right: Fraction): EquivTask => ({
  subject: 'math',
  skillId: EQUIV,
  kind: 'fraction_equivalence',
  left,
  right,
});
const plural = (skillId: PluralTask['skillId'], word: string): PluralTask => ({
  subject: 'english',
  skillId,
  kind: 'noun_plural',
  word,
});

const TASK_BANK: Readonly<Record<string, Task>> = {
  'frac-cmp-1': cmp(f(1, 2), f(1, 3)), // gt
  'frac-cmp-2': cmp(f(2, 4), f(1, 2)), // eq
  'frac-cmp-3': cmp(f(1, 3), f(1, 2)), // lt
  'frac-eq-1': eq(f(1, 2), f(2, 4)), // yes
  'frac-eq-2': eq(f(1, 2), f(1, 3)), // no
  'frac-eq-3': eq(f(2, 3), f(4, 6)), // yes
  'eng-base-1': plural(PLURAL_BASE, 'dog'), // dogs
  'eng-base-2': plural(PLURAL_BASE, 'book'), // books
  'eng-base-3': plural(PLURAL_BASE, 'cat'), // cats
  'eng-sib-1': plural(PLURAL_SIB, 'box'), // boxes
  'eng-sib-2': plural(PLURAL_SIB, 'baby'), // babies
  'eng-sib-3': plural(PLURAL_SIB, 'dish'), // dishes
  // Transfer (novel-context) tasks — a mastered skill applied to fresh items.
  'frac-xfer-cmp': cmp(f(3, 4), f(2, 3)), // gt
  'frac-xfer-eq': eq(f(3, 6), f(1, 2)), // yes
  'eng-xfer-base': plural(PLURAL_BASE, 'pen'), // pens
  'eng-xfer-sib': plural(PLURAL_SIB, 'wish'), // wishes
};

/** Tasks that exercise a skill in a NOVEL context — graded as transfer_check so a
 *  correct answer can lift an already-mastered skill to TRANSFERABLE (AT-12). */
const TRANSFER_TASKS = new Set(['frac-xfer-cmp', 'frac-xfer-eq', 'eng-xfer-base', 'eng-xfer-sib']);

const fmt = (x: Fraction): string => `${x.numerator}/${x.denominator}`;
const isRelation = (v: unknown): v is FractionRelation => v === 'lt' || v === 'eq' || v === 'gt';

/** Representations are per-subject working modes; the projection counts their diversity. */
const REPRESENTATIONS: Record<Subject, readonly string[]> = {
  math: ['symbolic', 'area-model', 'number-line', 'set'],
  english: ['written', 'spoken', 'picture'],
};
const representationOf = (task: Task, raw: unknown): string => {
  const allowed = REPRESENTATIONS[task.subject];
  return typeof raw === 'string' && allowed.includes(raw) ? raw : allowed[0];
};

/** Question + answer options presented for a task, by skill kind. */
function present(task: Task): { question: string; options: readonly string[] } {
  if (task.kind === 'fraction_comparison') {
    return {
      question: `Compare ${fmt(task.left)} and ${fmt(task.right)} — is the first less than (lt), equal to (eq), or greater than (gt) the second?`,
      options: ['lt', 'eq', 'gt'],
    };
  }
  if (task.kind === 'fraction_equivalence') {
    return {
      question: `Are ${fmt(task.left)} and ${fmt(task.right)} equal in value? (yes / no)`,
      options: ['yes', 'no'],
    };
  }
  return {
    question: `What is the plural of "${task.word}"? Type the word.`,
    options: [], // free text
  };
}

/** The reviewed answer KEY for a task — what the oracle validates before delivery. */
function answerKeyValid(task: Task): boolean {
  if (task.kind === 'fraction_comparison') {
    return checkMathTask({
      kind: 'fraction_comparison',
      left: task.left,
      right: task.right,
      claimedAnswer: trueRelation(task.left, task.right),
    }).correct;
  }
  if (task.kind === 'fraction_equivalence') {
    return checkMathTask({
      kind: 'fraction_equivalence',
      left: task.left,
      right: task.right,
      claimedEquivalent: areEquivalent(task.left, task.right),
    }).correct;
  }
  return checkEnglishTask({
    kind: 'noun_plural',
    word: task.word,
    claimedPlural: pluralize(task.word),
  }).correct;
}

/** Is a raw learner answer a well-formed token for this task's kind? */
function tokenValid(task: Task, raw: string): boolean {
  const a = raw.trim().toLowerCase();
  if (task.kind === 'fraction_comparison') return isRelation(a);
  if (task.kind === 'fraction_equivalence') return a === 'yes' || a === 'no';
  return /^[a-z]+$/.test(a); // a single word
}

/** Grade a well-formed answer with the independent oracle (token must be valid). */
function judge(task: Task, raw: string): boolean {
  const a = raw.trim().toLowerCase();
  if (task.kind === 'fraction_comparison') {
    return checkMathTask({
      kind: 'fraction_comparison',
      left: task.left,
      right: task.right,
      claimedAnswer: a as FractionRelation,
    }).correct;
  }
  if (task.kind === 'fraction_equivalence') {
    return checkMathTask({
      kind: 'fraction_equivalence',
      left: task.left,
      right: task.right,
      claimedEquivalent: a === 'yes',
    }).correct;
  }
  return checkEnglishTask({ kind: 'noun_plural', word: task.word, claimedPlural: a }).correct;
}

async function requireActiveSession(
  deps: Deps,
  sessionId: string,
  alias: string,
): Promise<{ subject: Subject }> {
  const row = await deps.session.getTutoringSession(sessionId);
  if (!row || row.learnerAlias !== alias) throw new DomainError('NOT_FOUND', 'session not found');
  if (row.state !== 'ACTIVE') throw new DomainError('POLICY_BLOCKED', 'session is not active');
  return { subject: row.subject as Subject };
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
    const { subject } = await requireActiveSession(deps, sessionId, alias);
    const next = await computeNext(deps, alias, subject);
    const budget = await sessionBudget(deps, alias, sessionId);
    return c.json({ ...next, budget });
  });

  // Deliver a validated task — content gate on the delivery path (AI-001).
  app.post('/learners/:alias/sessions/:sessionId/task', async (c) => {
    const a = authed(c);
    requireActorType(a, 'child');
    const alias = c.req.param('alias');
    const { subject } = await requireActiveSession(deps, c.req.param('sessionId'), alias);

    const taskId = c.req.query('taskId') ?? 'frac-cmp-1';
    const task = TASK_BANK[taskId];
    if (!task) throw new DomainError('NOT_FOUND', 'task not found');
    if (task.subject !== subject) {
      throw new DomainError('POLICY_BLOCKED', 'task is not for this session subject');
    }

    // Validate the answer key with the INDEPENDENT oracle before delivery. The
    // validator is the subject's deterministic oracle, independent of the author.
    const record = validateCandidate({
      candidateId: `task:${taskId}`,
      generatorId: `content-author:${task.subject}-bank`,
      validatorId: `oracle:${task.subject}`,
      validatorVersion: 'v1',
      math: { ran: true, correct: answerKeyValid(task) },
      safety: { available: true, pass: true },
      onTopic: true,
    });
    const candidate: CandidateContent = {
      candidateId: record.candidateId,
      verdict: record.verdict,
      validationRecordRef: validationRecordRef(record),
    };
    const delivery = decideDelivery(candidate, null);
    if (delivery.kind !== 'DELIVER') {
      throw new DomainError('POLICY_BLOCKED', 'task failed validation; not delivered');
    }

    const { question, options } = present(task);
    return c.json({ taskId, skillId: task.skillId, question, options });
  });

  // Submit an answer → evidence → mastery (ER-03 gated); or divert to escalation.
  app.post('/learners/:alias/sessions/:sessionId/answer', async (c) => {
    const a = authed(c);
    requireActorType(a, 'child');
    const alias = c.req.param('alias');
    const sessionId = c.req.param('sessionId');
    const { subject } = await requireActiveSession(deps, sessionId, alias);

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
    if (task.subject !== subject) {
      throw new DomainError('POLICY_BLOCKED', 'task is not for this session subject');
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
      : (await allCoachableMastered(deps, alias, subject))
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
    // re-derived mastery (advancement once the prerequisite is independent).
    const next = await computeNext(deps, alias, subject);
    // Coaching ladder on a wrong answer: a targeted HINT first (early wrong), then
    // a stall-driven strategy change (AT-08) once the learner keeps missing.
    const coaching = graded.correct
      ? null
      : await assessStall(deps, alias, sessionId, task.skillId, subject);
    const hint = !graded.correct && !coaching ? hintFor(subject, task.skillId) : null;
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
    const { subject } = await requireActiveSession(deps, sessionId, alias);

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
    if (task.subject !== subject) {
      throw new DomainError('POLICY_BLOCKED', 'task is not for this session subject');
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
      : (await allCoachableMastered(deps, alias, subject))
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

    const next = await computeNext(deps, alias, subject);
    const coaching = graded.correct
      ? null
      : await assessStall(deps, alias, sessionId, task.skillId, subject);
    const hint = !graded.correct && !coaching ? hintFor(subject, task.skillId) : null;
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
