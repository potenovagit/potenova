import { DomainError } from '@potenova/contracts';
import { AGE_BANDS, type AgeBand } from '@potenova/identity';
import { configured, pending, type PolicyValue } from './provenance';

/**
 * Age-band usage caps (ER-09 — EVIDENCE REQUIRED, owner Product/Child Safety).
 *
 * Absolute maximums on continuous-session and daily use per Ontario age band, on
 * child-health grounds. The NUMBERS are the child-safety/child-health expert's to
 * set (`usageCapsPolicyFrom(...)`); this is the mechanism, built now. A parent may
 * set a tighter limit but can NEVER exceed the safety maximum ("System may shorten
 * but not exceed parent ceiling or safety maximum" — PAR).
 *
 * Fail-closed: a band whose cap is pending (or, under requireApproved, unsigned)
 * yields BLOCKED_UNCONFIGURED — no usage is permitted in prod until an approved
 * cap exists, rather than defaulting to some invented number.
 */

export interface UsageCaps {
  /** Hard maximum of a single continuous session, minutes. */
  readonly maxContinuousMinutes: number;
  /** Hard maximum total usage per day, minutes. */
  readonly maxDailyMinutes: number;
  /** Required break after a continuous block, minutes (0 = none). */
  readonly breakAfterMinutes: number;
}

export type UsageCapsPolicy = Readonly<Record<AgeBand, PolicyValue<UsageCaps>>>;

/** Starting state — every band pending ER-09. */
export function emptyUsageCapsPolicy(decisionId = 'ER-09'): UsageCapsPolicy {
  const out = {} as Record<AgeBand, PolicyValue<UsageCaps>>;
  for (const b of AGE_BANDS) out[b] = pending(decisionId, `usage caps for ${b}`);
  return out;
}

/** Build a policy from the expert's caps; bands omitted stay pending. */
export function usageCapsPolicyFrom(
  entries: Partial<
    Record<AgeBand, { caps: UsageCaps; setBy: string; setAt?: string; approved?: boolean }>
  >,
  decisionId = 'ER-09',
): UsageCapsPolicy {
  const out = {} as Record<AgeBand, PolicyValue<UsageCaps>>;
  for (const b of AGE_BANDS) {
    const e = entries[b];
    out[b] = e
      ? configured(decisionId, e.caps, { setBy: e.setBy, setAt: e.setAt, approved: e.approved })
      : pending(decisionId, `usage caps for ${b}`);
  }
  return out;
}

export interface UsageQuery {
  readonly band: AgeBand;
  /** How long this session wants to run, minutes. */
  readonly requestedSessionMinutes: number;
  /** Minutes already used today. */
  readonly usedTodayMinutes: number;
  /** The parent's chosen limits — may tighten, never loosen. */
  readonly parentCaps?: {
    readonly maxContinuousMinutes?: number;
    readonly maxDailyMinutes?: number;
  };
  readonly requireApproved?: boolean;
}

export type UsageDecisionKind = 'ALLOW' | 'SHORTEN' | 'STOP' | 'BLOCKED_UNCONFIGURED';

export interface UsageDecision {
  readonly kind: UsageDecisionKind;
  /** Minutes this session may run (0 for STOP / BLOCKED). */
  readonly allowedMinutes: number;
  readonly effectiveContinuousCap: number;
  readonly dailyRemaining: number;
  readonly breakAfterMinutes: number;
  readonly reasonCodes: readonly string[];
}

function nonNegInt(n: number, label: string): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new DomainError('POLICY_BLOCKED', `${label} must be a non-negative integer`);
  }
  return n;
}

/**
 * Decide how long a session may run for a band, given the day's usage so far and
 * the parent's (tighter) limits. Fail-closed when the band's safety cap is not an
 * approved value.
 */
export function decideUsage(policy: UsageCapsPolicy, q: UsageQuery): UsageDecision {
  nonNegInt(q.requestedSessionMinutes, 'requestedSessionMinutes');
  nonNegInt(q.usedTodayMinutes, 'usedTodayMinutes');

  const v = policy[q.band];
  const usable = v?.status === 'configured' && (!q.requireApproved || v.approved);
  if (!usable || v.status !== 'configured') {
    return {
      kind: 'BLOCKED_UNCONFIGURED',
      allowedMinutes: 0,
      effectiveContinuousCap: 0,
      dailyRemaining: 0,
      breakAfterMinutes: 0,
      reasonCodes: ['UNCONFIGURED'],
    };
  }

  const safety = v.value;
  const reason = new Set<string>();

  // Parent may tighten, never loosen: effective = min(safety, parent).
  const parentCont = q.parentCaps?.maxContinuousMinutes ?? Number.POSITIVE_INFINITY;
  const parentDaily = q.parentCaps?.maxDailyMinutes ?? Number.POSITIVE_INFINITY;
  if (parentCont > safety.maxContinuousMinutes || parentDaily > safety.maxDailyMinutes) {
    reason.add('PARENT_EXCEEDS_SAFETY_IGNORED');
  }
  const effectiveContinuousCap = Math.min(safety.maxContinuousMinutes, parentCont);
  const effectiveDailyCap = Math.min(safety.maxDailyMinutes, parentDaily);
  if (parentCont < safety.maxContinuousMinutes || parentDaily < safety.maxDailyMinutes) {
    reason.add('PARENT_LIMIT_APPLIED');
  }

  const dailyRemaining = Math.max(0, effectiveDailyCap - q.usedTodayMinutes);

  if (dailyRemaining <= 0) {
    reason.add('DAILY_CAP_REACHED');
    return {
      kind: 'STOP',
      allowedMinutes: 0,
      effectiveContinuousCap,
      dailyRemaining: 0,
      breakAfterMinutes: safety.breakAfterMinutes,
      reasonCodes: [...reason],
    };
  }

  const allowedMinutes = Math.min(
    q.requestedSessionMinutes,
    effectiveContinuousCap,
    dailyRemaining,
  );
  if (allowedMinutes < effectiveContinuousCap && allowedMinutes === dailyRemaining) {
    reason.add('LIMITED_BY_DAILY_REMAINING');
  }
  if (
    allowedMinutes === effectiveContinuousCap &&
    effectiveContinuousCap < q.requestedSessionMinutes
  ) {
    reason.add('LIMITED_BY_CONTINUOUS_CAP');
  }

  let kind: UsageDecisionKind;
  if (allowedMinutes <= 0) kind = 'STOP';
  else if (allowedMinutes < q.requestedSessionMinutes) kind = 'SHORTEN';
  else kind = 'ALLOW';

  return {
    kind,
    allowedMinutes,
    effectiveContinuousCap,
    dailyRemaining,
    breakAfterMinutes: safety.breakAfterMinutes,
    reasonCodes: [...reason],
  };
}

export interface UsageCapsReadiness {
  readonly ready: boolean;
  readonly unconfigured: readonly AgeBand[];
  readonly unapproved: readonly AgeBand[];
}

export function checkUsageCapsReadiness(policy: UsageCapsPolicy): UsageCapsReadiness {
  const unconfigured = AGE_BANDS.filter((b) => policy[b]?.status !== 'configured');
  const unapproved = AGE_BANDS.filter((b) => {
    const v = policy[b];
    return v?.status === 'configured' && !v.approved;
  });
  return { ready: unconfigured.length === 0 && unapproved.length === 0, unconfigured, unapproved };
}

/**
 * Gate check — in prod, every band must have an approved cap or this fails closed
 * (no child uses the product without an approved usage cap — ER-09). Advisory in
 * non-prod.
 *
 * @throws DomainError POLICY_BLOCKED — prod with any unconfigured/unapproved band.
 */
export function assertUsageCapsReady(policy: UsageCapsPolicy, isProd: boolean): UsageCapsReadiness {
  const r = checkUsageCapsReadiness(policy);
  if (isProd && !r.ready) {
    throw new DomainError(
      'POLICY_BLOCKED',
      `usage caps incomplete (ER-09): unconfigured=[${r.unconfigured.join(',')}] unapproved=[${r.unapproved.join(',')}]`,
    );
  }
  return r;
}
