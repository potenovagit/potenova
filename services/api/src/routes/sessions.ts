import type { Context, Hono } from 'hono';
import { DomainError } from '@potenova/contracts';
import {
  planSession,
  readySession,
  activateSession,
  endEarly,
  type SessionState,
} from '@potenova/planner';
import { learningActive, type EntitlementState } from '@potenova/billing';
import { decideUsage } from '@potenova/policy';
import { AGE_BANDS, type AgeBand } from '@potenova/identity';
import { readAuth, requireActorType, assertRegion, type AuthCtx } from '../auth';
import { type Deps } from '../deps';
import { buildSessionSummary, computeNext, sessionBudget, courseFor } from '../adaptive';

/**
 * Child-facing tutoring sessions (the vertical slice start).
 *
 * Starting a session composes the full guard stack at the edge before the
 * planner's session machine can go ACTIVE:
 *   child actor + Canadian residency (authz)
 *   → consent fence (active child_learning grant)
 *   → entitlement (billing learningActive)
 *   → usage caps (ER-09; parent may tighten, never exceed; fail-closed)
 *   → planSession → readySession(gate) → activateSession → persist.
 * A child may stop at any time; ending early is neutral (AT-26) — no mastery loss.
 */

async function hasChildLearningConsent(deps: Deps, familyAlias: string | null): Promise<boolean> {
  if (!familyAlias) return false;
  const grants = await deps.identity.listConsentGrants(familyAlias);
  return grants.some((g) => g.purpose === 'child_learning' && g.state === 'GIVEN');
}

interface StartBody {
  subject?: string;
  /** Optional strand/course within the subject (e.g. 'addition'); default by subject. */
  strand?: string;
  requestedMinutes?: number;
}

/** UTC day key (YYYY-MM-DD) for the usage ledger. */
function utcDay(iso: string): string {
  return iso.slice(0, 10);
}

export function registerSessions(app: Hono, deps: Deps): void {
  const authed = (c: Context): AuthCtx => {
    const a = readAuth(c, deps.config.primaryRegion);
    assertRegion(a);
    return a;
  };

  app.post('/learners/:alias/sessions', async (c) => {
    const a = authed(c);
    requireActorType(a, 'child');
    const alias = c.req.param('alias');
    const b = await c.req.json<StartBody>().catch(() => ({}) as StartBody);

    if (b.subject !== 'math' && b.subject !== 'english') {
      throw new DomainError('POLICY_BLOCKED', "subject must be 'math' or 'english'");
    }
    const requestedMinutes = b.requestedMinutes ?? 0;
    // Guardian controls (PAR): a subject-matched strand focus and tightened caps.
    const pref = await deps.session.getGuardianPreference(alias);
    const focusStrand =
      pref && pref.focusSubject === b.subject ? (pref.focusStrand ?? undefined) : undefined;
    // The strand/course the session runs: an explicit request wins, else the
    // guardian's focus for this subject, else the subject default.
    const course = courseFor(b.subject, b.strand ?? focusStrand);
    // A guardian-preferred skill reorders within a planner tier (never a gate).
    const parentPreferredSkillIds =
      pref?.focusSkillId && pref.focusSubject === b.subject ? [pref.focusSkillId] : undefined;

    // Age band is derived from the learner's registered grade — never self-declared.
    const learner = await deps.identity.getLearner(alias);
    if (!learner) throw new DomainError('NOT_FOUND', 'learner not found');
    if (!(AGE_BANDS as readonly string[]).includes(learner.ageBand)) {
      throw new DomainError('POLICY_BLOCKED', 'learner has no valid age band');
    }
    const band = learner.ageBand as AgeBand;

    // Consent fence.
    const consentOk = await hasChildLearningConsent(deps, a.actor.familyAlias);

    // Entitlement (tutoring active?).
    const ent = a.actor.familyAlias ? await deps.billing.getEntitlement(a.actor.familyAlias) : null;
    const entitlementActive = ent ? learningActive(ent.state as EntitlementState) : false;

    // Usage caps (ER-09) over the day's usage from the ledger. In prod the cap
    // must be approved; in non-prod the illustrative staging caps apply.
    const day = utcDay(new Date().toISOString());
    const usedTodayMinutes = await deps.session.getUsageMinutes(alias, day);
    const usage = decideUsage(deps.policies.usageCaps, {
      band,
      requestedSessionMinutes: requestedMinutes,
      usedTodayMinutes,
      // Parent limits may only tighten the safety cap, never loosen it.
      parentCaps: pref
        ? {
            maxDailyMinutes: pref.maxDailyMinutes ?? undefined,
            maxContinuousMinutes: pref.maxContinuousMinutes ?? undefined,
          }
        : undefined,
      requireApproved: deps.policies.isProd,
    });
    const withinAgeCap = usage.kind === 'ALLOW' || usage.kind === 'SHORTEN';

    // The session machine enforces the non-negotiable preconditions (and throws
    // the specific CONSENT_REQUIRED / ENTITLEMENT_INACTIVE / POLICY_BLOCKED).
    const sessionId = `sess-${Date.now()}-${alias}`;
    let session = planSession({ sessionId, learnerAlias: alias, subject: b.subject });
    session = readySession(session, { consentOk, entitlementActive, withinAgeCap });
    session = activateSession(session);

    await deps.session.saveTutoringSession({
      sessionId,
      learnerAlias: alias,
      subject: b.subject,
      state: session.state,
      strand: course,
    });

    // Reserve the allotment against today's usage so the cap holds across
    // sessions (conservative; early-end reconciliation is a later refinement).
    await deps.session.addUsageMinutes(alias, day, usage.allowedMinutes);

    // The first objective is PLANNER-selected (adaptive), not a fixed task — the
    // client opens the session straight onto next.defaultTaskId.
    const next = await computeNext(deps, alias, course, { sessionId, parentPreferredSkillIds });
    // Session item budget (ER-09) the learner-protection ceiling for this session.
    const budget = await sessionBudget(deps, alias, sessionId);

    return c.json(
      {
        session,
        subject: b.subject,
        strand: course, // the resolved strand/course this session runs
        allowedMinutes: usage.allowedMinutes,
        breakAfterMinutes: usage.breakAfterMinutes,
        usage: { kind: usage.kind, reasonCodes: usage.reasonCodes },
        next,
        budget,
      },
      201,
    );
  });

  // A child-initiated stop. Neutral: no mastery change, no shaming (AT-26).
  app.post('/learners/:alias/sessions/:sessionId/end', async (c) => {
    const a = authed(c);
    requireActorType(a, 'child');
    const row = await deps.session.getTutoringSession(c.req.param('sessionId'));
    if (!row) throw new DomainError('NOT_FOUND', 'session not found');
    if (row.learnerAlias !== c.req.param('alias')) {
      throw new DomainError('FORBIDDEN_ROLE', 'session does not belong to this learner');
    }
    const current = {
      sessionId: row.sessionId,
      learnerAlias: row.learnerAlias,
      subject: row.subject as 'math' | 'english',
      state: row.state as SessionState,
    };
    const { session: ended, masteryChanged } = endEarly(current);
    await deps.session.saveTutoringSession({ ...row, state: ended.state });
    // Wrap-up: the session-scoped summary (neutral — AT-26, no mastery loss).
    const summary = await buildSessionSummary(deps, row.learnerAlias, row.sessionId);
    return c.json({ session: ended, masteryChanged, summary });
  });

  // Session-scoped parent report (guardian): what the child did in THIS session.
  // Observed evidence (this session) is kept separate from derived mastery (the
  // cumulative, re-computed state) — never a predicted grade (PAR-001/002/003).
  app.get('/learners/:alias/sessions/:sessionId/report', async (c) => {
    const a = authed(c);
    requireActorType(a, 'guardian');
    const alias = c.req.param('alias');
    const sessionId = c.req.param('sessionId');

    const row = await deps.session.getTutoringSession(sessionId);
    if (!row || row.learnerAlias !== alias) throw new DomainError('NOT_FOUND', 'session not found');

    // Tenant isolation: the guardian must belong to the learner's family (TM-45).
    const learner = await deps.identity.getLearner(alias);
    if (!learner || learner.familyId !== a.actor.familyAlias) {
      throw new DomainError('FORBIDDEN_ROLE', 'not authorized for this learner');
    }

    return c.json(await buildSessionSummary(deps, alias, sessionId));
  });
}
