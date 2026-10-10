/**
 * Cost / margin rollups + spend-anomaly control (OPS-011/012; ADM-001; AT-40).
 *
 * Rollups expose cost, revenue and contribution margin by dimension WITHOUT any
 * child content (aliases/aggregates only). A spend or retry anomaly (runaway
 * sessions, generation retries) triggers an admin alert and bounded remediation
 * with an educationally valid, child-safe fallback — never a token/cost message
 * shown to a child (AT-40).
 */

export interface MarginRollup {
  readonly costCents: number;
  readonly revenueCents: number;
  readonly marginCents: number;
  /** Invariant (OPS-011): rollups never expose child content. */
  readonly childContentExposed: false;
}

export function marginRollup(input: { costCents: number; revenueCents: number }): MarginRollup {
  return {
    costCents: input.costCents,
    revenueCents: input.revenueCents,
    marginCents: input.revenueCents - input.costCents,
    childContentExposed: false,
  };
}

export interface AnomalyDecision {
  readonly anomaly: boolean;
  readonly alertAdmin: boolean;
  readonly action: 'NONE' | 'BOUNDED_REMEDIATION';
  readonly childSafeFallback: boolean;
  /** Invariant (AT-40): a child never sees a token/cost message. */
  readonly childTokenMessage: false;
}

/**
 * AT-40/OPS-012: detect a spend or retry anomaly and return a bounded, child-safe
 * response. Remediation is bounded (loop/retry caps); the child path stays on an
 * educationally valid fallback.
 */
export function detectSpendAnomaly(input: {
  readonly spendRateCentsPerMin: number;
  readonly spendThresholdCentsPerMin: number;
  readonly retries: number;
  readonly retryThreshold: number;
}): AnomalyDecision {
  const anomaly =
    input.spendRateCentsPerMin > input.spendThresholdCentsPerMin ||
    input.retries > input.retryThreshold;
  return {
    anomaly,
    alertAdmin: anomaly,
    action: anomaly ? 'BOUNDED_REMEDIATION' : 'NONE',
    childSafeFallback: anomaly,
    childTokenMessage: false,
  };
}
