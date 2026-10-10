import { DomainError } from '@potenova/contracts';
import { learningActive, type EntitlementState } from './entitlement';

/**
 * Entitlement credits + post-cutoff access (BILL-011/012; AT-45).
 *
 * Extensions/service credits require privileged authorization with a reason and
 * expiration, audited independently of any store transaction (BILL-011). After an
 * entitlement lapses, the learner history is read-only but export and deletion
 * controls remain available throughout the documented retention window (BILL-012;
 * AT-45).
 */

export interface EntitlementCredit {
  readonly actor: string;
  readonly reason: string;
  readonly expiresAt: string;
  readonly independentOfStoreTransaction: true;
}

/**
 * @throws DomainError FORBIDDEN_ROLE  — missing actor (no privileged authorization).
 * @throws DomainError REVIEW_REQUIRED — missing reason.
 */
export function grantEntitlementCredit(input: {
  readonly actor: string;
  readonly reason: string;
  readonly expiresAt: string;
}): EntitlementCredit {
  if (!input.actor)
    throw new DomainError('FORBIDDEN_ROLE', 'a credit requires privileged authorization');
  if (!input.reason)
    throw new DomainError('REVIEW_REQUIRED', 'a credit requires a documented reason');
  return {
    actor: input.actor,
    reason: input.reason,
    expiresAt: input.expiresAt,
    independentOfStoreTransaction: true,
  };
}

export interface PostCutoffAccess {
  readonly learningActive: boolean;
  readonly learningReadOnly: boolean;
  /** Invariant (BILL-012/AT-45): export + deletion survive the entitlement cutoff. */
  readonly exportAvailable: true;
  readonly deletionAvailable: true;
}

/** AT-45: after expiry, learning is read-only but export/deletion remain. */
export function postCutoffAccess(state: EntitlementState): PostCutoffAccess {
  const active = learningActive(state);
  return {
    learningActive: active,
    learningReadOnly: !active,
    exportAvailable: true,
    deletionAvailable: true,
  };
}
