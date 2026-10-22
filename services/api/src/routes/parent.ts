import type { Context, Hono } from 'hono';
import { DomainError } from '@potenova/contracts';
import type { GuardianPreferenceRow } from '@potenova/persistence';
import { readAuth, requireActorType, requireStepUp, assertRegion, type AuthCtx } from '../auth';
import { now, type Deps } from '../deps';
import {
  COURSES_BY_SUBJECT,
  courseCoachableSkills,
  courseFor,
  projectConceptual,
  type Subject,
} from '../adaptive';
import { ER03_CANDIDATE_V02 } from '@potenova/learner-state';

/**
 * Guardian controls (PAR): a subject→strand focus and tightened usage caps.
 *
 * These feed existing planner/policy signals — they never set mastery and can
 * only CONSTRAIN, never loosen: a parent cap may lower the safety ceiling but
 * never raise it (decideUsage enforces min(safety, parent)), and a focus only
 * reorders within a planner tier or pins the session's strand; it can never skip
 * a prerequisite or cross a non-negotiable gate. Guardian-only, tenant-isolated.
 *
 * This route also serves two guardian self-service reads/writes: today's usage
 * minutes from the ledger (read-only, derived), and data-subject-request intake
 * (DSAR). A guardian can REQUEST access/export or erasure of their own child's
 * data; the request is recorded for the privacy team / operator to fulfil. The
 * guardian never executes an erasure here — that stays operator-authz in the
 * privacy route, fail-closed. Nothing on this route sets mastery.
 */

/** UTC day key (YYYY-MM-DD) for the usage ledger — mirrors sessions.ts. */
function utcDay(iso: string): string {
  return iso.slice(0, 10);
}

const DATA_REQUEST_KINDS = ['access', 'erasure'] as const;
type DataRequestKind = (typeof DATA_REQUEST_KINDS)[number];

interface PreferenceBody {
  focus?: { subject?: string; strand?: string } | null;
  focusSkillId?: string | null;
  caps?: { maxDailyMinutes?: number | null; maxContinuousMinutes?: number | null } | null;
}

function posIntOrNull(v: unknown, label: string): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
    throw new DomainError('POLICY_BLOCKED', `${label} must be a non-negative integer`);
  }
  return v;
}

export function registerParent(app: Hono, deps: Deps): void {
  const authed = (c: Context): AuthCtx => {
    const a = readAuth(c, deps.config.primaryRegion);
    assertRegion(a);
    return a;
  };

  // Tenant isolation: the guardian must own the learner's family (TM-45).
  const assertOwnsLearner = async (a: AuthCtx, alias: string) => {
    const learner = await deps.identity.getLearner(alias);
    if (!learner || learner.familyId !== a.actor.familyAlias) {
      throw new DomainError('FORBIDDEN_ROLE', 'not authorized for this learner');
    }
  };

  app.get('/learners/:alias/preferences', async (c) => {
    const a = authed(c);
    requireActorType(a, 'guardian');
    const alias = c.req.param('alias');
    await assertOwnsLearner(a, alias);
    const pref = await deps.session.getGuardianPreference(alias);
    return c.json({ preference: pref ?? { learnerAlias: alias } });
  });

  app.put('/learners/:alias/preferences', async (c) => {
    const a = authed(c);
    requireActorType(a, 'guardian');
    const alias = c.req.param('alias');
    await assertOwnsLearner(a, alias);

    const b = await c.req.json<PreferenceBody>().catch(() => ({}) as PreferenceBody);

    // Strand focus: subject + strand set together and valid for that subject.
    let focusSubject: string | null = null;
    let focusStrand: string | null = null;
    if (b.focus && (b.focus.subject || b.focus.strand)) {
      const subject = b.focus.subject;
      const strand = b.focus.strand;
      if (subject !== 'math' && subject !== 'english') {
        throw new DomainError('POLICY_BLOCKED', "focus.subject must be 'math' or 'english'");
      }
      if (!strand || !(COURSES_BY_SUBJECT[subject] as string[]).includes(strand)) {
        throw new DomainError(
          'POLICY_BLOCKED',
          `focus.strand is not a valid strand for ${subject}`,
        );
      }
      focusSubject = subject;
      focusStrand = strand;
    }

    // Optional within-course skill to prioritise (tie-break only). When a focus
    // strand is set, it must be a coachable skill of that course.
    let focusSkillId: string | null = null;
    if (b.focusSkillId) {
      if (focusSubject && focusStrand) {
        const course = courseFor(focusSubject as Subject, focusStrand);
        if (!courseCoachableSkills(course).includes(b.focusSkillId)) {
          throw new DomainError(
            'POLICY_BLOCKED',
            'focusSkillId is not a coachable skill of the focused strand',
          );
        }
      }
      focusSkillId = b.focusSkillId;
    }

    const row: GuardianPreferenceRow = {
      learnerAlias: alias,
      focusSubject,
      focusStrand,
      focusSkillId,
      maxDailyMinutes: posIntOrNull(b.caps?.maxDailyMinutes, 'caps.maxDailyMinutes'),
      maxContinuousMinutes: posIntOrNull(b.caps?.maxContinuousMinutes, 'caps.maxContinuousMinutes'),
    };
    await deps.session.saveGuardianPreference(row);
    return c.json({ preference: row }, 200);
  });

  // Today's learning time from the usage ledger (derived, read-only). Returns the
  // parent's daily limit when set; the enforced ceiling is min(safety cap, parent
  // cap), so the limit shown is the parent's own, never the internal safety value.
  app.get('/learners/:alias/usage', async (c) => {
    const a = authed(c);
    requireActorType(a, 'guardian');
    const alias = c.req.param('alias');
    await assertOwnsLearner(a, alias);
    const day = utcDay(now());
    const usedTodayMinutes = await deps.session.getUsageMinutes(alias, day);
    const pref = await deps.session.getGuardianPreference(alias);
    return c.json({ day, usedTodayMinutes, maxDailyMinutes: pref?.maxDailyMinutes ?? null });
  });

  // Conceptual-understanding read (ER-03), derived off the immutable ledger for
  // one assessed-core skill. Read-only and advisory: the grade is taken from the
  // learner record (never a caller-chosen value — educator R7), the result is
  // grade-gated fail-closed, and the ER-03 policy is a CANDIDATE, so the response
  // says `policyApproved: false`. This surfaces WHY a skill is or isn't shown as
  // understood (the four dimensions + unmet reasons); it never sets mastery.
  app.get('/learners/:alias/conceptual/:skillId', async (c) => {
    const a = authed(c);
    requireActorType(a, 'guardian');
    const alias = c.req.param('alias');
    await assertOwnsLearner(a, alias);
    const skillId = c.req.param('skillId');

    // Only assessed-core skills carry a conceptual policy; anything else is a 404
    // rather than a silent empty result.
    const policy = ER03_CANDIDATE_V02.skills[skillId];
    if (!policy || policy.role !== 'assessed-core') {
      throw new DomainError('NOT_FOUND', 'no conceptual assessment for this skill');
    }

    const learner = await deps.identity.getLearner(alias);
    if (!learner) throw new DomainError('NOT_FOUND', 'learner not found');

    const { result, policyApproved } = await projectConceptual(deps, alias, skillId, learner.grade);
    return c.json({
      skillId,
      gradeTarget: learner.grade,
      policyVersion: result.policyVersion,
      policyApproved, // ER-03 candidate → false; advisory, not an approved decision
      state: result.state,
      dimensions: result.dimensions,
      sessions: result.sessions,
      representations: result.representations,
      eligibleCount: result.eligibleCount,
      unmet: result.unmet,
      independenceAt: result.independenceAt,
    });
  });

  // DSAR intake: a guardian REQUESTS access/export or erasure of their own child's
  // data. The request is recorded (RECEIVED) for the privacy team / operator to
  // fulfil — a guardian never executes an erasure (that is operator-authz in the
  // privacy route). Tenant-isolated: only for a learner in the guardian's family.
  app.post('/learners/:alias/data-requests', async (c) => {
    const a = authed(c);
    requireActorType(a, 'guardian');
    // Export/erasure is a sensitive action (ADR-0008) — require step-up re-verification.
    requireStepUp(a);
    const alias = c.req.param('alias');
    await assertOwnsLearner(a, alias);

    const b = await c.req
      .json<{ kind?: string; note?: string }>()
      .catch(() => ({}) as { kind?: string; note?: string });
    if (!b.kind || !DATA_REQUEST_KINDS.includes(b.kind as DataRequestKind)) {
      throw new DomainError('POLICY_BLOCKED', "kind must be 'access' or 'erasure'");
    }
    const kind = b.kind as DataRequestKind;
    const note = typeof b.note === 'string' ? b.note.slice(0, 2000) : undefined;

    const requestId = `dsr-req-${Date.now()}-${alias}`;
    const receivedAt = now();
    await deps.erasure.saveDataSubjectRequest({
      requestId,
      kind: `${kind}_request`,
      subjectType: 'learner',
      subjectId: alias,
      reason: 'subject_request',
      state: 'RECEIVED',
      outcomesJson: JSON.stringify({
        requestedBy: a.actor.actorAlias,
        familyId: a.actor.familyAlias,
        note,
      }),
      updatedAt: receivedAt,
    });
    await deps.safety.recordAudit({
      approver: a.actor.actorAlias,
      reason: 'subject_request',
      object: `learner:${alias}`,
      action: `data_request_${kind}_received`,
      outcome: 'RECEIVED',
      expiry: null,
      at: receivedAt,
    });
    return c.json({ requestId, kind, state: 'received', receivedAt }, 201);
  });

  // Read the status of a guardian's own data-subject request.
  app.get('/learners/:alias/data-requests/:requestId', async (c) => {
    const a = authed(c);
    requireActorType(a, 'guardian');
    const alias = c.req.param('alias');
    await assertOwnsLearner(a, alias);
    const requestId = c.req.param('requestId');
    const row = await deps.erasure.getDataSubjectRequest(requestId);
    if (!row || row.subjectType !== 'learner' || row.subjectId !== alias) {
      throw new DomainError('NOT_FOUND', 'data request not found');
    }
    return c.json({
      requestId: row.requestId,
      kind: row.kind.replace(/_request$/, ''),
      state: row.state,
      updatedAt: row.updatedAt,
    });
  });
}
