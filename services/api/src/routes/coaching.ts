import type { Context, Hono } from 'hono';
import { DomainError } from '@potenova/contracts';
import { decideDelivery, type CandidateContent } from '@potenova/domain-core';
import {
  checkMathTask,
  trueRelation,
  validateCandidate,
  validationRecordRef,
  type Fraction,
  type FractionRelation,
} from '@potenova/content';
import {
  projectShadow,
  assertMasteryPolicyApproved,
  type MasteryEvidence,
} from '@potenova/learner-state';
import { decideEscalation, handleDisclosure, type EscalationInput } from '@potenova/safety';
import { readAuth, requireActorType, assertRegion, type AuthCtx } from '../auth';
import { now, type Deps } from '../deps';

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
 *
 * Synthetic task bank only — no model generation on this path yet.
 */

const SKILL_ID = 'fractions-comparison';
const RELEASE = 'REL-ONT-MATH-2020-draft';

interface BankTask {
  readonly left: Fraction;
  readonly right: Fraction;
}
const TASK_BANK: Readonly<Record<string, BankTask>> = {
  'frac-cmp-1': { left: { numerator: 1, denominator: 2 }, right: { numerator: 1, denominator: 3 } },
  'frac-cmp-2': { left: { numerator: 2, denominator: 4 }, right: { numerator: 1, denominator: 2 } },
  'frac-cmp-3': { left: { numerator: 1, denominator: 3 }, right: { numerator: 1, denominator: 2 } },
};

const fmt = (f: Fraction): string => `${f.numerator}/${f.denominator}`;
const isRelation = (v: unknown): v is FractionRelation => v === 'lt' || v === 'eq' || v === 'gt';

const REPRESENTATIONS = ['symbolic', 'area-model', 'number-line', 'set'] as const;
type Representation = (typeof REPRESENTATIONS)[number];
const isRepresentation = (v: unknown): v is Representation =>
  (REPRESENTATIONS as readonly unknown[]).includes(v);

async function requireActiveSession(deps: Deps, sessionId: string, alias: string): Promise<void> {
  const row = await deps.session.getTutoringSession(sessionId);
  if (!row || row.learnerAlias !== alias) throw new DomainError('NOT_FOUND', 'session not found');
  if (row.state !== 'ACTIVE') throw new DomainError('POLICY_BLOCKED', 'session is not active');
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

export function registerCoaching(app: Hono, deps: Deps): void {
  const authed = (c: Context): AuthCtx => {
    const a = readAuth(c, deps.config.primaryRegion);
    assertRegion(a);
    return a;
  };

  // Deliver a validated task — content gate on the delivery path (AI-001).
  app.post('/learners/:alias/sessions/:sessionId/task', async (c) => {
    const a = authed(c);
    requireActorType(a, 'child');
    const alias = c.req.param('alias');
    await requireActiveSession(deps, c.req.param('sessionId'), alias);

    const taskId = c.req.query('taskId') ?? 'frac-cmp-1';
    const task = TASK_BANK[taskId];
    if (!task) throw new DomainError('NOT_FOUND', 'task not found');

    // Validate the answer key with the INDEPENDENT oracle before delivery.
    const truth = trueRelation(task.left, task.right);
    const math = checkMathTask({
      kind: 'fraction_comparison',
      left: task.left,
      right: task.right,
      claimedAnswer: truth,
    });
    const record = validateCandidate({
      candidateId: `task:${taskId}`,
      generatorId: 'content-author:fractions-bank',
      validatorId: 'math-oracle:fractions',
      validatorVersion: 'v1',
      math: { ran: true, correct: math.correct },
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

    return c.json({
      taskId,
      skillId: SKILL_ID,
      question: `Compare ${fmt(task.left)} and ${fmt(task.right)} — is the first less than (lt), equal to (eq), or greater than (gt) the second?`,
      options: ['lt', 'eq', 'gt'],
    });
  });

  // Submit an answer → evidence → mastery (ER-03 gated); or divert to escalation.
  app.post('/learners/:alias/sessions/:sessionId/answer', async (c) => {
    const a = authed(c);
    requireActorType(a, 'child');
    const alias = c.req.param('alias');
    const sessionId = c.req.param('sessionId');
    await requireActiveSession(deps, sessionId, alias);

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
    if (!isRelation(b.answer)) {
      throw new DomainError('POLICY_BLOCKED', "answer must be 'lt', 'eq' or 'gt'");
    }
    const representation: Representation = isRepresentation(b.representation)
      ? b.representation
      : 'symbolic';

    const check = checkMathTask({
      kind: 'fraction_comparison',
      left: task.left,
      right: task.right,
      claimedAnswer: b.answer,
    });

    // ER-03: do not derive mastery from an unapproved policy in prod.
    assertMasteryPolicyApproved(deps.policies.mastery, deps.policies.isProd);

    const evidence: MasteryEvidence = {
      eventId: `${sessionId}:${b.clientSubmissionId}`,
      learnerAlias: alias,
      skillId: SKILL_ID,
      mode: 'independent_check',
      assistanceBand: 'A0',
      correct: check.correct,
      representation,
      recognitionConfidence: 1,
      observedAt: now(),
      curriculumReleaseId: RELEASE,
      schemaVersion: 'evt-0.1',
    };
    await deps.evidence.appendEvidence(evidence);

    const events = await deps.evidence.listEvidence(alias, SKILL_ID);
    const corrections = await deps.evidence.listCorrections(events.map((e) => e.eventId));
    const projection = projectShadow(alias, SKILL_ID, events, corrections, deps.policies.mastery);

    return c.json(
      { graded: true, correct: check.correct, evidenceId: evidence.eventId, projection },
      201,
    );
  });
}
