import type { OperatorPermission } from './operator-roles';

/**
 * Dual authorization for the highest-risk operator actions (SEC-003).
 * Source: SEC-003 ("Dual authorization SHALL be required for defined highest-risk
 * actions. One operator cannot independently export bulk child data or disable
 * critical safety controls.").
 *
 * This is separation of duty (maker-checker): the worst actions require TWO
 * distinct operators — one to request, a different one to approve — on top of
 * the role (SEC-013) and just-in-time elevation (SEC-002). It is the third axis
 * of the operator model: RBAC bounds WHAT one operator may do, JIT bounds WHEN,
 * and dual authorization requires WHO-ELSE for the catastrophic actions.
 *
 * The SET of highest-risk actions is a governance decision (EVIDENCE REQUIRED;
 * owner: Security — ADR-0040), not something an implementation may finalize.
 * The registry below is the provisional default: the two actions the requirement
 * itself names. Each action also declares the operator permission both parties
 * must hold. A dedicated permission or a distinct second-approver role (e.g. a
 * safety officer for disabling a safety control, per SAFE-007) is a follow-on
 * governance decision; both actions reuse `operator:account_admin` for now.
 */

export interface DualAuthRule {
  /** The operator permission BOTH the requester and the approver must hold. */
  readonly permission: OperatorPermission;
  /** Human-readable label for audit / operator UI. */
  readonly label: string;
}

export const DUAL_AUTH_ACTIONS = {
  'child_data.bulk_export': {
    permission: 'operator:account_admin',
    label: 'Bulk child-data export',
  },
  'safety_control.disable': {
    permission: 'operator:account_admin',
    label: 'Disable a critical safety control',
  },
} as const satisfies Record<string, DualAuthRule>;

export type DualAuthAction = keyof typeof DUAL_AUTH_ACTIONS;

export function isDualAuthAction(v: unknown): v is DualAuthAction {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(DUAL_AUTH_ACTIONS, v);
}

/** The rule (permission + label) for a defined dual-auth action. */
export function dualAuthRule(action: DualAuthAction): DualAuthRule {
  return DUAL_AUTH_ACTIONS[action];
}

/**
 * A pending request is short-lived — an approval cannot be banked. The exact
 * window is a reversible IMPLEMENTATION DECISION (ADR-0040).
 */
export const DUAL_AUTH_REQUEST_TTL_SECONDS = 3600;

/** Lifecycle of a dual-authorization request. */
export const DUAL_AUTH_STATES = ['PENDING', 'CONSUMED', 'DENIED', 'EXPIRED'] as const;
export type DualAuthState = (typeof DUAL_AUTH_STATES)[number];
