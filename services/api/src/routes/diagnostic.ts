import type { Context, Hono } from 'hono';
import { DomainError } from '@potenova/contracts';
import { assertMasteryPolicyApproved, type MasteryEvidence } from '@potenova/learner-state';
import {
  buildBaselineProfile,
  generateInitialPlan,
  DRAFT_DIAGNOSTIC_POLICY,
} from '@potenova/diagnostic';
import { readAuth, requireActorType, assertRegion, type AuthCtx } from '../auth';
import { now, type Deps } from '../deps';
import {
  courseFor,
  courseCoachableSkills,
  courseGraph,
  computeNext,
  type Subject,
} from '../adaptive';
import {
  TASK_BANK,
  RELEASE_BY_SUBJECT,
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
    // The entry objective off the derived placement (what a session would open on).
    const entry = await computeNext(deps, alias, course);

    return c.json({ subject, course, profile, plan, entry });
  });
}
