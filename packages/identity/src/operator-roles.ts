import { type ActorContext, DomainError } from '@potenova/contracts';

/**
 * Operator RBAC (least-privilege authorization at the operator boundary).
 * Source: SEC-013 (least-privilege authz at domain boundaries), SEC-002
 * (time-bound just-in-time elevation for sensitive operational access),
 * ACTOR_TYPES `operator` ("privileged admin, JIT, audited").
 *
 * The `operator` actor type is NOT a single, all-powerful role. An operator
 * carries a role whose permission set is checked at every privileged boundary,
 * so a read-only QA/viewer operator can never mutate an account, and account
 * administration is reserved to an admin. This is the operator-side analogue of
 * the guardian capability model in `authorization.ts`.
 *
 * Roles and permissions are an IMPLEMENTATION DECISION (reversible; ADR-0038),
 * deliberately small: a fuller set (safety review under SAFE-007, capability
 * kill-switch admin under OPS-007, dual-authorization under SEC-003) is added as
 * those controls land. Some roles therefore overlap today and diverge as new
 * permissions are introduced.
 */

export const OPERATOR_ROLES = ['admin', 'support', 'read_only'] as const;
export type OperatorRole = (typeof OPERATOR_ROLES)[number];

export function isOperatorRole(v: unknown): v is OperatorRole {
  return typeof v === 'string' && (OPERATOR_ROLES as readonly string[]).includes(v);
}

export const OPERATOR_PERMISSIONS = [
  /** Read the operator surfaces — metrics, safety/AI posture, status. */
  'operator:read',
  /** Suspend / reactivate a family account (account administration). */
  'operator:account_admin',
  /** Register or deactivate another operator (identity administration). */
  'operator:operator_admin',
] as const;
export type OperatorPermission = (typeof OPERATOR_PERMISSIONS)[number];

/**
 * Role → permission grants. Fail-closed by omission: a permission not listed for
 * a role is denied. `admin` is the only role that may administer accounts or
 * other operators; `support` and `read_only` are read-only today.
 */
const ROLE_PERMISSIONS: Readonly<Record<OperatorRole, readonly OperatorPermission[]>> = {
  admin: ['operator:read', 'operator:account_admin', 'operator:operator_admin'],
  support: ['operator:read'],
  read_only: ['operator:read'],
};

export function permissionsFor(role: OperatorRole): readonly OperatorPermission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/** Does this operator role hold `permission`? Fail-closed. */
export function operatorCan(
  role: OperatorRole | undefined,
  permission: OperatorPermission,
): boolean {
  if (!role) return false;
  return permissionsFor(role).includes(permission);
}

export interface OperatorAuthzRequest {
  readonly actor: ActorContext;
  readonly operatorRole?: OperatorRole;
  readonly permission: OperatorPermission;
}

/**
 * Assert an operator may exercise `permission`. Fail-closed: the actor must be an
 * `operator` AND its role must grant the permission.
 *
 * @throws DomainError FORBIDDEN_ROLE — not an operator, or the role lacks it.
 */
export function assertOperatorPermission(req: OperatorAuthzRequest): void {
  if (req.actor.actorType !== 'operator') {
    throw new DomainError('FORBIDDEN_ROLE', 'requires an operator actor');
  }
  if (!operatorCan(req.operatorRole, req.permission)) {
    throw new DomainError('FORBIDDEN_ROLE', `operator role lacks ${req.permission}`);
  }
}
