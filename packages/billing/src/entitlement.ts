import { DomainError } from '@potenova/contracts';

/**
 * Entitlement lifecycle (Architecture §3.7; BILL-006/008/009).
 *
 *   TRIAL_ACTIVE -> TRIAL_EXPIRED -> INACTIVE | PAID_ACTIVE
 *   PAID_ACTIVE  -> PAST_DUE_GRACE -> PAID_ACTIVE | PAID_EXPIRED
 *   PAID_ACTIVE  -> CANCEL_SCHEDULED (access retained until period end) -> PAID_EXPIRED | PAID_ACTIVE
 *
 * Grace keeps learning active; expiry pauses it gracefully. Forbidden (enforced
 * elsewhere too): a transaction event never erases learning evidence, a trial
 * never auto-charges, and payment prompts never appear in child UI.
 */

export const ENTITLEMENT_STATES = [
  'TRIAL_ACTIVE',
  'TRIAL_EXPIRED',
  'INACTIVE',
  'PAID_ACTIVE',
  'PAST_DUE_GRACE',
  'CANCEL_SCHEDULED',
  'PAID_EXPIRED',
] as const;
export type EntitlementState = (typeof ENTITLEMENT_STATES)[number];

const TRANSITIONS: Readonly<Record<EntitlementState, readonly EntitlementState[]>> = {
  TRIAL_ACTIVE: ['TRIAL_EXPIRED', 'PAID_ACTIVE'],
  TRIAL_EXPIRED: ['INACTIVE', 'PAID_ACTIVE'],
  INACTIVE: ['PAID_ACTIVE'],
  PAID_ACTIVE: ['PAST_DUE_GRACE', 'CANCEL_SCHEDULED', 'PAID_EXPIRED'],
  PAST_DUE_GRACE: ['PAID_ACTIVE', 'PAID_EXPIRED'],
  CANCEL_SCHEDULED: ['PAID_ACTIVE', 'PAID_EXPIRED'],
  PAID_EXPIRED: ['PAID_ACTIVE', 'INACTIVE'],
};

/** States in which tutoring stays active — grace and scheduled-cancel included. */
const LEARNING_ACTIVE: ReadonlySet<EntitlementState> = new Set<EntitlementState>([
  'TRIAL_ACTIVE',
  'PAID_ACTIVE',
  'PAST_DUE_GRACE',
  'CANCEL_SCHEDULED',
]);

export function learningActive(state: EntitlementState): boolean {
  return LEARNING_ACTIVE.has(state);
}

export function canTransitionEntitlement(from: EntitlementState, to: EntitlementState): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

/**
 * Transition the entitlement. Re-applying the current state is an idempotent
 * no-op (BILL-008: provider events may repeat / arrive out of order).
 *
 * @throws DomainError CONFLICT — an illegal transition.
 */
export function transitionEntitlement(
  from: EntitlementState,
  to: EntitlementState,
): EntitlementState {
  if (from === to) return to;
  if (!TRANSITIONS[from].includes(to)) {
    throw new DomainError('CONFLICT', `illegal entitlement transition ${from} -> ${to}`);
  }
  return to;
}
