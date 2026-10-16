import type { Context, Hono } from 'hono';
import { DomainError } from '@potenova/contracts';
import type { GuardianPreferenceRow } from '@potenova/persistence';
import { readAuth, requireActorType, assertRegion, type AuthCtx } from '../auth';
import { type Deps } from '../deps';
import { COURSES_BY_SUBJECT, courseCoachableSkills, courseFor, type Subject } from '../adaptive';

/**
 * Guardian controls (PAR): a subject→strand focus and tightened usage caps.
 *
 * These feed existing planner/policy signals — they never set mastery and can
 * only CONSTRAIN, never loosen: a parent cap may lower the safety ceiling but
 * never raise it (decideUsage enforces min(safety, parent)), and a focus only
 * reorders within a planner tier or pins the session's strand; it can never skip
 * a prerequisite or cross a non-negotiable gate. Guardian-only, tenant-isolated.
 */

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
}
