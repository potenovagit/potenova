import { type ActorContext, DomainError } from '@potenova/contracts';
import type { GuardianRole } from './entities';

/**
 * Role/capability authorization (WP-01).
 * Source: ACC-003/004/005/007; TM-01; AT-02/24/52.
 *
 * Two independent guards:
 *  1. capability membership — does this actor's role/type hold the capability?
 *  2. step-up — sensitive capabilities additionally require fresh re-verification.
 *
 * Child sessions hold ONLY learning capabilities and can never reach parent
 * functions, even on a shared device (ACC-003, AT-24).
 */

export const CAPABILITIES = [
  // parent/guardian surfaces
  'view_progress',
  'set_priorities',
  'invite_guardian',
  'modify_guardian',
  'manage_billing',
  'export_learner',
  'delete_learner',
  // child learning surfaces
  'start_diagnostic',
  'do_tutoring',
  'submit_attempt',
] as const;
export type Capability = (typeof CAPABILITIES)[number];

/** Sensitive capabilities require a valid, unexpired step-up proof (ACC-007). */
export const SENSITIVE_CAPABILITIES: ReadonlySet<Capability> = new Set<Capability>([
  'invite_guardian',
  'modify_guardian',
  'manage_billing',
  'export_learner',
  'delete_learner',
]);

const OWNER_CAPS: readonly Capability[] = [
  'view_progress',
  'set_priorities',
  'invite_guardian',
  'modify_guardian',
  'manage_billing',
  'export_learner',
  'delete_learner',
];

const LEARNING_VIEWER_CAPS: readonly Capability[] = ['view_progress'];

const CHILD_CAPS: readonly Capability[] = ['start_diagnostic', 'do_tutoring', 'submit_attempt'];

function guardianCaps(role: GuardianRole): readonly Capability[] {
  return role === 'owner' ? OWNER_CAPS : LEARNING_VIEWER_CAPS;
}

export interface AuthzRequest {
  readonly actor: ActorContext;
  readonly capability: Capability;
  /** The guardian's role, when the actor is a guardian. */
  readonly guardianRole?: GuardianRole;
  /** Whether a valid, unexpired step-up proof is present this request. */
  readonly stepUpSatisfied?: boolean;
}

/**
 * Assert the actor may exercise `capability`. Fail-closed.
 *
 * @throws DomainError FORBIDDEN_ROLE — capability not held by this actor/role
 * @throws DomainError AUTH_REQUIRED  — sensitive capability without step-up
 */
export function assertCapability(req: AuthzRequest): void {
  const { actor, capability } = req;

  let held: readonly Capability[];
  if (actor.actorType === 'child') {
    held = CHILD_CAPS;
  } else if (actor.actorType === 'guardian') {
    held = guardianCaps(req.guardianRole ?? 'learning_viewer');
  } else {
    // No other actor type holds family-facing capabilities here.
    held = [];
  }

  if (!held.includes(capability)) {
    // e.g. child → manage_billing (AT-24); learning_viewer → delete_learner (AT-02)
    throw new DomainError('FORBIDDEN_ROLE', 'capability not held by actor');
  }

  if (SENSITIVE_CAPABILITIES.has(capability) && !req.stepUpSatisfied) {
    // Privileged action without fresh re-verification is denied (AT-52).
    throw new DomainError('AUTH_REQUIRED', 'step-up verification required');
  }
}
