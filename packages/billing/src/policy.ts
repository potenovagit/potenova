/**
 * Billing policy (WP-12) — versioned, DRAFT parameters.
 *
 * ============================================================================
 *  NON-NEGOTIABLE (CLAUDE.md; ER-01): price, trial length and token caps are
 *  NEVER invented as final values. Per BILL-003/005 the system carries term
 *  METADATA without a hard-coded production price, and the trial has NO
 *  unvalidated fixed day/token limit. Every numeric below is null or a DRAFT
 *  placeholder behind a version string — decided from beta economics, not here.
 * ============================================================================
 */

export const SUBJECTS = ['math', 'english'] as const;
export type Subject = (typeof SUBJECTS)[number];

export const TERMS = ['monthly', 'annual'] as const;
export type Term = (typeof TERMS)[number];

export const PURCHASE_CHANNELS = ['web', 'apple', 'google'] as const;
export type PurchaseChannel = (typeof PURCHASE_CHANNELS)[number];

export interface BillingPolicy {
  readonly policyVersion: string;
  /** Prices are decided from beta economics — never hard-coded (BILL-003). */
  readonly priceByTerm: Readonly<Record<Term, null>>;
  /** Trial has no unvalidated fixed day limit (BILL-005; ER-01). */
  readonly trialDayLimit: null;
  /** Trial has no unvalidated fixed token/cost cut-off (BILL-005; ER-01). */
  readonly trialTokenLimit: null;
  /** Grace window length is EVIDENCE REQUIRED; supplied by the caller at runtime. */
  readonly graceWindowMs: null;
}

export const DRAFT_BILLING_POLICY: BillingPolicy = {
  policyVersion: 'billing-DRAFT-0.1(ER-01-UNPRICED)',
  priceByTerm: { monthly: null, annual: null },
  trialDayLimit: null,
  trialTokenLimit: null,
  graceWindowMs: null,
};
