import { DomainError } from '@potenova/contracts';
import type { EntitlementState } from './entitlement';

/**
 * Card-free trial (BILL-005/006/013; AT-41).
 *
 * The first trial requires no card and never auto-converts to paid. It offers the
 * full educational experience (diagnostic, plan, tutoring) with no unvalidated
 * fixed day/token limit (ER-01). Expiry pauses tutoring and preserves the profile,
 * leaving upgrade options to the parent only. Abuse control is proportionate:
 * verified parent contact + rate limit, no intrusive ID verification.
 */

export interface TrialStart {
  readonly state: EntitlementState; // TRIAL_ACTIVE
  readonly requiresCard: false;
  readonly autoConverts: false;
}

/**
 * Start a trial for a verified parent contact, subject to a per-contact rate limit.
 *
 * @throws DomainError RATE_LIMITED   — too many prior trials for this contact.
 * @throws DomainError AUTH_REQUIRED  — parent contact not verified.
 */
export function startTrial(input: {
  readonly parentContactVerified: boolean;
  readonly priorTrialsForContact: number;
  readonly maxTrialsPerContact: number;
}): TrialStart {
  if (!input.parentContactVerified) {
    throw new DomainError(
      'AUTH_REQUIRED',
      'a verified parent contact is required to start a trial',
    );
  }
  if (input.priorTrialsForContact >= input.maxTrialsPerContact) {
    throw new DomainError('RATE_LIMITED', 'trial limit reached for this parent contact');
  }
  return { state: 'TRIAL_ACTIVE', requiresCard: false, autoConverts: false };
}

export interface TrialExpiry {
  readonly state: EntitlementState; // TRIAL_EXPIRED
  /** Invariant (BILL-006): tutoring pauses but the learner profile is preserved. */
  readonly profilePreserved: true;
  /** Invariant (BILL-006): upgrade is parent-only; never an auto-charge. */
  readonly upgradeParentOnly: true;
}

export function expireTrial(): TrialExpiry {
  return { state: 'TRIAL_EXPIRED', profilePreserved: true, upgradeParentOnly: true };
}
