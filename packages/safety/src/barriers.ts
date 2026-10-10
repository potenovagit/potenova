import { DomainError } from '@potenova/contracts';
import { isApprovedRegion } from '@potenova/contracts';

/**
 * Hard access barriers (AT-24/51/55; PRIV-003).
 *
 * - Billing details are never reachable from a child session, even on a shared
 *   device (AT-24).
 * - Production child learning history is never released for model evaluation —
 *   only synthetic/de-identified replay is permitted (AT-51; PRIV-003).
 * - A learner reaching from a disallowed region is not transferred to a
 *   noncompliant provider/region; a safe notice is returned (AT-55).
 */

/**
 * @throws DomainError FORBIDDEN_ROLE — always; billing is inaccessible from a child session.
 */
export function assertNoBillingFromChildSession(): never {
  throw new DomainError(
    'FORBIDDEN_ROLE',
    'billing details are not accessible from a child session',
  );
}

export type EvalDataRequest =
  | 'production_child_history'
  | 'synthetic_replay'
  | 'deidentified_replay';

/**
 * @throws DomainError POLICY_BLOCKED — a request for production child history for evaluation.
 */
export function assertEvalDataAllowed(kind: EvalDataRequest): void {
  if (kind === 'production_child_history') {
    throw new DomainError(
      'POLICY_BLOCKED',
      'production child learning history is never released for evaluation (synthetic/de-identified only)',
    );
  }
}

export type ResidencyDecision =
  | { readonly kind: 'ALLOW' }
  | { readonly kind: 'DENY'; readonly reason: 'REGION_DISALLOWED'; readonly safeNotice: true };

/** AT-55: a disallowed region is refused with a safe notice, never transferred out. */
export function residencyBarrier(processingRegion: string): ResidencyDecision {
  if (isApprovedRegion(processingRegion)) return { kind: 'ALLOW' };
  return { kind: 'DENY', reason: 'REGION_DISALLOWED', safeNotice: true };
}
