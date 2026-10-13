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
  requestedMinutes?: number;
  /** Age band — derived from the learner record in production; accepted here for
   *  the synthetic slice. */
  ageBand?: string;
  usedTodayMinutes?: number;
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
    if (!b.ageBand || !(AGE_BANDS as readonly string[]).includes(b.ageBand)) {
      throw new DomainError('POLICY_BLOCKED', 'a valid ageBand is required');
    }
    const requestedMinutes = b.requestedMinutes ?? 0;

    // Consent fence.
    const consentOk = await hasChildLearningConsent(deps, a.actor.familyAlias);

    // Entitlement (tutoring active?).
    const ent = a.actor.familyAlias ? await deps.billing.getEntitlement(a.actor.familyAlias) : null;
    const entitlementActive = ent ? learningActive(ent.state as EntitlementState) : false;

    // Usage caps (ER-09). In prod the cap must be approved; in non-prod the
    // illustrative staging caps apply.
    const usage = decideUsage(deps.policies.usageCaps, {
      band: b.ageBand as AgeBand,
      requestedSessionMinutes: requestedMinutes,
      usedTodayMinutes: b.usedTodayMinutes ?? 0,
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
    });

    return c.json(
      {
        session,
        allowedMinutes: usage.allowedMinutes,
        breakAfterMinutes: usage.breakAfterMinutes,
        usage: { kind: usage.kind, reasonCodes: usage.reasonCodes },
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
    return c.json({ session: ended, masteryChanged });
  });
}
