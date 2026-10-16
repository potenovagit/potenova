import type { Context, Hono } from 'hono';
import { DomainError } from '@potenova/contracts';
import {
  assertMasteryPolicyApproved,
  projectShadow,
  type MasteryEvidence,
} from '@potenova/learner-state';
import {
  buildBaselineProfile,
  generateInitialPlan,
  placementEvidence,
  decideStop,
  createRun,
  transitionRun,
  DRAFT_DIAGNOSTIC_POLICY,
  type DiagnosticCandidate,
  type DiagnosticRunState,
} from '@potenova/diagnostic';
import { readAuth, requireActorType, assertRegion, type AuthCtx } from '../auth';
import { now, type Deps } from '../deps';
import {
  courseFor,
  courseCoachableSkills,
  courseGraph,
  subjectOfCourse,
  probeTaskId,
  computeNext,
  type CourseId,
  type Subject,
} from '../adaptive';
import {
  RELEASE_BY_SUBJECT,
  REPRESENTATIONS,
  present,
  tokenValid,
  judge,
  representationOf,
  gateTask,
} from '../task-bank';

/**
 * Diagnostic → placement (DIA-002/003/007/008; AT-05).
 *
 * The diagnostic SEEDS starting mastery instead of always entering at the
 * prerequisite. Probe answers are gate-validated and oracle-graded (never
 * client-asserted) and written as immutable `mode:'diagnostic'` evidence; the
 * mastery authority then re-derives placement from that evidence exactly as it
 * does for coached turns — the diagnostic never hand-sets mastery. A learner who
 * demonstrates a prerequisite in the diagnostic starts the session advanced past
 * it (confidence-limited), rather than being re-taught from the root.
 *
 * Synthetic probes only — no model on this path. Consent-fenced and Canadian-
 * residency-guarded at the edge like every child-facing endpoint.
 */

async function hasChildLearningConsent(deps: Deps, familyAlias: string | null): Promise<boolean> {
  if (!familyAlias) return false;
  const grants = await deps.identity.listConsentGrants(familyAlias);
  return grants.some((g) => g.purpose === 'child_learning' && g.state === 'GIVEN');
}

interface ProbeAnswer {
  clientSubmissionId?: string;
  taskId?: string;
  answer?: string;
  representation?: string;
}
interface ProbeBody {
  runId?: string;
  probes?: ProbeAnswer[];
}

/** Count diagnostic evidence events for a skill WITHIN a run (variant + rep index). */
async function diagProbesForSkill(
  deps: Deps,
  alias: string,
  runId: string,
  skillId: string,
): Promise<number> {
  const events = await deps.evidence.listEvidence(alias, skillId);
  const prefix = `diag:${runId}:`;
  return events.filter((e) => e.eventId.startsWith(prefix)).length;
}

/** Build the diagnostic candidate set for a course from the learner's placement
 *  evidence: per-skill confidence/state from the shadow projection, plus the
 *  foundational fan-out (how many targets depend on it) from the graph. */
async function buildCandidates(
  deps: Deps,
  alias: string,
  course: CourseId,
  learnerGrade: number,
): Promise<DiagnosticCandidate[]> {
  const targets = courseCoachableSkills(course);
  const graph = courseGraph(course);
  const all = await deps.evidence.listEvidenceForLearner(alias);
  const placement = placementEvidence(all);
  const corrections = await deps.evidence.listCorrections(placement.map((e) => e.eventId));
  return targets.map((skillId) => {
    const p = projectShadow(alias, skillId, placement, corrections, deps.policies.mastery);
    const foundationalFanout = targets.filter(
      (t) => t !== skillId && graph.prerequisiteClosure(t).includes(skillId),
    ).length;
    return {
      skillId,
      grade: learnerGrade,
      priorConfidence: p.confidence,
      priorState: p.state,
      representationsCovered: p.dimensions.representationsCovered,
      foundationalFanout,
      valid: true,
    };
  });
}

/** Deliver the next probe: a gate-validated task for the chosen skill, with the
 *  item rotated by how many times this skill has already been probed in the run. */
async function deliverProbe(
  deps: Deps,
  alias: string,
  runId: string,
  course: CourseId,
  skillId: string,
): Promise<{ skillId: string; taskId: string; question: string; options: readonly string[] }> {
  const variant = await diagProbesForSkill(deps, alias, runId, skillId);
  const taskId = probeTaskId(course, skillId, variant);
  if (!taskId) throw new DomainError('NOT_FOUND', 'no probe task for skill');
  const task = gateTask(taskId); // content gate before any item reaches the child
  const { question, options } = present(task);
  return { skillId, taskId, question, options };
}

/** The placement view (baseline + initial plan + entry objective) for a course,
 *  all re-derived from immutable evidence by the mastery authority. */
async function buildPlacement(deps: Deps, alias: string, course: CourseId) {
  const targets = courseCoachableSkills(course);
  const graph = courseGraph(course);
  const allEvents = await deps.evidence.listEvidenceForLearner(alias);
  const corrections = await deps.evidence.listCorrections(allEvents.map((e) => e.eventId));
  const profile = buildBaselineProfile(
    alias,
    targets,
    allEvents,
    corrections,
    deps.policies.mastery,
  );
  const plan = generateInitialPlan(
    `placement:${alias}:${course}`,
    profile,
    graph,
    targets,
    DRAFT_DIAGNOSTIC_POLICY,
  );
  const entry = await computeNext(deps, alias, course);
  return { subject: subjectOfCourse(course), course, profile, plan, entry };
}

export function registerDiagnostic(app: Hono, deps: Deps): void {
  const authed = (c: Context): AuthCtx => {
    const a = readAuth(c, deps.config.primaryRegion);
    assertRegion(a);
    return a;
  };

  // Record synthetic diagnostic probe answers as immutable placement evidence.
  // Pre-session (a trial diagnostic needs no entitlement), but still consent-fenced.
  app.post('/learners/:alias/diagnostic/probes', async (c) => {
    const a = authed(c);
    requireActorType(a, 'child');
    const alias = c.req.param('alias');

    if (!(await hasChildLearningConsent(deps, a.actor.familyAlias))) {
      throw new DomainError('CONSENT_REQUIRED', 'no active child_learning consent for this family');
    }
    // Writing placement evidence feeds the mastery authority — fail closed on an
    // unapproved mastery policy in prod exactly as the coaching path does.
    assertMasteryPolicyApproved(deps.policies.mastery, deps.policies.isProd);

    const b = await c.req.json<ProbeBody>().catch(() => ({}) as ProbeBody);
    const runId = b.runId;
    if (!runId) throw new DomainError('POLICY_BLOCKED', 'runId is required');
    if (!Array.isArray(b.probes) || b.probes.length === 0) {
      throw new DomainError('POLICY_BLOCKED', 'at least one probe is required');
    }

    const results: Array<{ skillId: string; correct: boolean; recorded: boolean }> = [];
    for (const p of b.probes) {
      if (!p.clientSubmissionId) {
        throw new DomainError('POLICY_BLOCKED', 'clientSubmissionId is required for each probe');
      }
      // Content gate: the probe item's answer key is oracle-validated before use.
      const task = gateTask(p.taskId ?? '');
      if (typeof p.answer !== 'string' || !tokenValid(task, p.answer)) {
        throw new DomainError('POLICY_BLOCKED', 'answer is not valid for this probe');
      }

      // At-most-once: a retried probe produces no second evidence event (AT-27).
      const eventId = `diag:${runId}:${p.clientSubmissionId}`;
      const sub = await deps.session.recordSubmission(eventId, now());
      if (!sub.accepted) {
        results.push({ skillId: task.skillId, correct: judge(task, p.answer), recorded: false });
        continue;
      }

      const correct = judge(task, p.answer);
      const evidence: MasteryEvidence = {
        eventId,
        learnerAlias: alias,
        skillId: task.skillId,
        mode: 'diagnostic', // placement-admissible, NOT a coached turn
        assistanceBand: 'A0', // unaided probe
        correct,
        representation: representationOf(task, p.representation),
        recognitionConfidence: 1,
        observedAt: now(),
        curriculumReleaseId: RELEASE_BY_SUBJECT[task.subject],
        schemaVersion: 'evt-0.1',
      };
      await deps.evidence.appendEvidence(evidence);
      results.push({ skillId: task.skillId, correct, recorded: true });
    }

    return c.json({ runId, results }, 201);
  });

  // Placement view (guardian): the baseline standing per target skill, the
  // initial plan, and the entry objective the planner would coach first — all
  // derived from the recorded diagnostic evidence (never hand-set).
  app.get('/learners/:alias/placement', async (c) => {
    const a = authed(c);
    requireActorType(a, 'guardian');
    const alias = c.req.param('alias');

    const subject = c.req.query('subject');
    if (subject !== 'math' && subject !== 'english') {
      throw new DomainError('POLICY_BLOCKED', "subject must be 'math' or 'english'");
    }
    // Tenant isolation: the guardian must own the learner's family (TM-45).
    const learner = await deps.identity.getLearner(alias);
    if (!learner || learner.familyId !== a.actor.familyAlias) {
      throw new DomainError('FORBIDDEN_ROLE', 'not authorized for this learner');
    }

    const course = courseFor(subject as Subject, c.req.query('strand'));
    return c.json(await buildPlacement(deps, alias, course));
  });

  // ---- Adaptive diagnostic run (server-driven; DIA-001/006/012; AT-05/07) ----
  //
  // The SERVER picks each probe by information gain + foundational weight over the
  // learner's accumulated evidence, and stops on confidence (SUFFICIENT) or a
  // learner-protection ceiling (PARTIAL) — never a fixed question count. Each probe
  // is a gate-validated, oracle-graded item recorded as immutable `diagnostic`
  // evidence; placement is then re-derived. No model on this path.

  // Start a run: returns the first server-selected probe (or completion if the
  // learner's prior evidence already resolves every target).
  app.post('/learners/:alias/diagnostic/runs', async (c) => {
    const a = authed(c);
    requireActorType(a, 'child');
    const alias = c.req.param('alias');
    if (!(await hasChildLearningConsent(deps, a.actor.familyAlias))) {
      throw new DomainError('CONSENT_REQUIRED', 'no active child_learning consent for this family');
    }
    assertMasteryPolicyApproved(deps.policies.mastery, deps.policies.isProd);

    const b = await c.req
      .json<{ subject?: string; strand?: string }>()
      .catch(() => ({}) as { subject?: string; strand?: string });
    if (b.subject !== 'math' && b.subject !== 'english') {
      throw new DomainError('POLICY_BLOCKED', "subject must be 'math' or 'english'");
    }
    const learner = await deps.identity.getLearner(alias);
    if (!learner) throw new DomainError('NOT_FOUND', 'learner not found');
    const course = courseFor(b.subject, b.strand);
    const grade = learner.grade;

    const runId = `diag-${Date.now()}-${alias}`;
    let run = createRun({
      runId,
      learnerAlias: alias,
      subject: b.subject,
      curriculumReleaseId: RELEASE_BY_SUBJECT[b.subject],
      targetSkillIds: courseCoachableSkills(course),
    });
    run = transitionRun(run, 'ACTIVE');

    const candidates = await buildCandidates(deps, alias, course, grade);
    const decision = decideStop({
      candidates,
      learnerGrade: grade,
      probesUsed: 0,
      ageCeilingReached: false,
      policy: DRAFT_DIAGNOSTIC_POLICY,
    });
    const state: DiagnosticRunState =
      decision.kind === 'CONTINUE'
        ? 'ACTIVE'
        : (transitionRun(run, decision.kind).state as DiagnosticRunState);

    await deps.session.saveDiagnosticRun({
      runId,
      runVersion: run.runVersion,
      learnerAlias: alias,
      subject: b.subject,
      strand: course,
      curriculumReleaseId: RELEASE_BY_SUBJECT[b.subject],
      state,
      probesUsed: 0,
    });

    if (decision.kind === 'CONTINUE') {
      const next = await deliverProbe(deps, alias, runId, course, decision.nextSkillId);
      return c.json(
        { runId, state, probesUsed: 0, policyVersion: DRAFT_DIAGNOSTIC_POLICY.policyVersion, next },
        201,
      );
    }
    return c.json(
      {
        runId,
        state,
        probesUsed: 0,
        complete: true,
        stop: decision,
        placement: await buildPlacement(deps, alias, course),
      },
      201,
    );
  });

  // Answer the current probe → oracle-graded diagnostic evidence → next probe or
  // completion. The engine assigns the representation (diversity is a measured
  // placement signal, not client-controlled).
  app.post('/learners/:alias/diagnostic/runs/:runId/answer', async (c) => {
    const a = authed(c);
    requireActorType(a, 'child');
    const alias = c.req.param('alias');
    const runId = c.req.param('runId');
    if (!(await hasChildLearningConsent(deps, a.actor.familyAlias))) {
      throw new DomainError('CONSENT_REQUIRED', 'no active child_learning consent for this family');
    }
    assertMasteryPolicyApproved(deps.policies.mastery, deps.policies.isProd);

    const row = await deps.session.getDiagnosticRun(runId);
    if (!row || row.learnerAlias !== alias) throw new DomainError('NOT_FOUND', 'run not found');
    if (row.state !== 'ACTIVE')
      throw new DomainError('POLICY_BLOCKED', 'diagnostic run is not active');
    const subject = row.subject as Subject;
    const course = courseFor(subject, row.strand);

    const b = await c.req.json<ProbeAnswer>().catch(() => ({}) as ProbeAnswer);
    if (!b.clientSubmissionId) {
      throw new DomainError('POLICY_BLOCKED', 'clientSubmissionId is required');
    }
    const task = gateTask(b.taskId ?? ''); // content gate
    if (task.course !== course) {
      throw new DomainError('POLICY_BLOCKED', 'task is not for this run course');
    }
    if (typeof b.answer !== 'string' || !tokenValid(task, b.answer)) {
      throw new DomainError('POLICY_BLOCKED', 'answer is not valid for this probe');
    }

    // At-most-once (AT-27).
    const eventId = `diag:${runId}:${b.clientSubmissionId}`;
    const sub = await deps.session.recordSubmission(eventId, now());
    if (!sub.accepted) return c.json({ duplicate: true });

    // Engine-assigned representation (cycles so diversity builds across probes).
    const perSkill = await diagProbesForSkill(deps, alias, runId, task.skillId);
    const reps = REPRESENTATIONS[subject];
    const representation = reps[perSkill % reps.length] ?? representationOf(task, undefined);

    const correct = judge(task, b.answer);
    await deps.evidence.appendEvidence({
      eventId,
      learnerAlias: alias,
      skillId: task.skillId,
      mode: 'diagnostic',
      assistanceBand: 'A0',
      correct,
      representation,
      recognitionConfidence: 1,
      observedAt: now(),
      curriculumReleaseId: RELEASE_BY_SUBJECT[task.subject],
      schemaVersion: 'evt-0.1',
    });

    const probesUsed = row.probesUsed + 1;
    const grade = (await deps.identity.getLearner(alias))?.grade ?? 0;
    const candidates = await buildCandidates(deps, alias, course, grade);
    const decision = decideStop({
      candidates,
      learnerGrade: grade,
      probesUsed,
      ageCeilingReached: false,
      policy: DRAFT_DIAGNOSTIC_POLICY,
    });
    const state: DiagnosticRunState = decision.kind === 'CONTINUE' ? 'ACTIVE' : decision.kind;

    await deps.session.saveDiagnosticRun({ ...row, state, probesUsed });

    const graded = { graded: true as const, correct, skillId: task.skillId, probesUsed };
    if (decision.kind === 'CONTINUE') {
      const next = await deliverProbe(deps, alias, runId, course, decision.nextSkillId);
      return c.json({ ...graded, next }, 201);
    }
    return c.json(
      {
        ...graded,
        complete: true,
        stop: decision,
        placement: await buildPlacement(deps, alias, course),
      },
      201,
    );
  });
}
