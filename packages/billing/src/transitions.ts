import { transitionEntitlement, type EntitlementState } from './entitlement';

/**
 * Upgrade / downgrade / grace transitions (BILL-008/009; AT-43/44).
 *
 * An upgrade takes effect immediately when the channel confirms entitlement; a
 * downgrade takes effect at the end of the current paid period (access retained
 * meanwhile). A failed charge within a supported grace window retains entitlement
 * and keeps tutoring active. All transitions are idempotent and never touch
 * learning evidence.
 */

export interface TransitionResult {
  readonly state: EntitlementState;
  readonly effective: 'IMMEDIATE' | 'END_OF_PERIOD';
  /** Invariant (BILL-008): entitlement transitions leave learning evidence untouched. */
  readonly evidenceTouched: false;
}

/** BILL-008: confirmed upgrade → PAID_ACTIVE immediately (idempotent). */
export function confirmUpgrade(from: EntitlementState): TransitionResult {
  return {
    state: transitionEntitlement(from, 'PAID_ACTIVE'),
    effective: 'IMMEDIATE',
    evidenceTouched: false,
  };
}

/** BILL-008: downgrade is deferred — retain access until period end. */
export function scheduleDowngrade(from: EntitlementState): TransitionResult {
  return {
    state: transitionEntitlement(from, 'CANCEL_SCHEDULED'),
    effective: 'END_OF_PERIOD',
    evidenceTouched: false,
  };
}

/** BILL-009: a failed charge enters grace — tutoring continues until grace expires. */
export function enterGrace(from: EntitlementState): TransitionResult {
  return {
    state: transitionEntitlement(from, 'PAST_DUE_GRACE'),
    effective: 'IMMEDIATE',
    evidenceTouched: false,
  };
}

/** Grace lapses without recovery → PAID_EXPIRED. */
export function expireAfterGrace(from: EntitlementState): TransitionResult {
  return {
    state: transitionEntitlement(from, 'PAID_EXPIRED'),
    effective: 'IMMEDIATE',
    evidenceTouched: false,
  };
}
