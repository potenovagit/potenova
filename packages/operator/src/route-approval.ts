import { DomainError } from '@potenova/contracts';
import { ModelRegistry } from '@potenova/ai-gateway';

/**
 * Model / route approvals via the centralized registry (OPS-016; AT-37/38).
 *
 * Route approval runs through the one registry — there is no bypass path for
 * child inference. An operator can approve a model (privileged), but an
 * unapproved candidate can never receive production child content, even as a
 * "shadow" (AT-37). Routing a provider failover still only picks APPROVED,
 * in-region models (AT-38), which the registry's `routable` enforces.
 */

/**
 * Operator approves a model for production routing.
 *
 * @throws DomainError FORBIDDEN_ROLE — missing privileged approver.
 */
export function approveModelRoute(
  registry: ModelRegistry,
  modelId: string,
  approver: string,
): void {
  if (!approver)
    throw new DomainError('FORBIDDEN_ROLE', 'model approval requires a privileged approver');
  registry.setStatus(modelId, 'APPROVED');
}

/**
 * OPS-016/AT-37: assert a model may receive production child inference. Only an
 * APPROVED registry entry qualifies; anything else is refused (no shadow bypass).
 *
 * @throws DomainError POLICY_BLOCKED — the model is not approved for production.
 */
export function assertNoChildInferenceBypass(registry: ModelRegistry, modelId: string): void {
  if (!registry.isApprovedForProduction(modelId)) {
    throw new DomainError(
      'POLICY_BLOCKED',
      'unapproved model cannot receive production child inference',
    );
  }
}

/** AT-38: is there an approved, in-region failover for this need? */
export function hasApprovedFailover(
  registry: ModelRegistry,
  need: { region: string; ageBand: string; subject: string; capability: string },
  excludeModelId: string,
): boolean {
  return registry.routable(need).some((e) => e.modelId !== excludeModelId);
}
