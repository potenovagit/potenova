import { DomainError } from '@potenova/contracts';
import { learningActive, type EntitlementState } from './entitlement';

/**
 * Child-facing availability messaging (BILL-007; AT-24 adjacent).
 *
 * Pricing and payment never appear in a child experience. When entitlement has
 * lapsed, the child sees neutral availability messaging ("ask a parent"); payment
 * details are shown only in the parent experience.
 */

export interface ChildAvailabilityView {
  /** Invariant (BILL-007): a child view never shows pricing/payment. */
  readonly showsPricing: false;
  readonly message: 'available' | 'ask_a_parent';
}

export function childAvailabilityView(state: EntitlementState): ChildAvailabilityView {
  return { showsPricing: false, message: learningActive(state) ? 'available' : 'ask_a_parent' };
}

/**
 * Guard for any view rendered to a child.
 *
 * @throws DomainError POLICY_BLOCKED — a pricing/payment element in a child view.
 */
export function assertNoPricingInChildView(view: { readonly showsPricing: boolean }): void {
  if (view.showsPricing) {
    throw new DomainError(
      'POLICY_BLOCKED',
      'pricing/payment must not appear in a child experience',
    );
  }
}
