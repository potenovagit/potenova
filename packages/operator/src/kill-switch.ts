import type { AuditEvent } from '@potenova/safety';
import type { ContainableCapability } from './policy';

/**
 * Containment kill switches (SAFE-012; OPS-003/007).
 *
 * Operators can disable a dangerous capability, model, content path or modality
 * immediately — without waiting for an application redeploy. Switches are
 * versioned and auditable, and a disabled capability fails closed (not routable).
 */

export class KillSwitchRegistry {
  readonly #disabled = new Set<ContainableCapability>();
  readonly #audit: AuditEvent[] = [];

  disable(
    capability: ContainableCapability,
    actor: string,
    reason: string,
    at: string,
  ): AuditEvent {
    this.#disabled.add(capability);
    const event: AuditEvent = {
      approver: actor,
      reason,
      object: capability,
      action: 'kill_switch_disable',
      outcome: 'EXECUTED',
      expiry: null,
      at,
    };
    this.#audit.push(event);
    return event;
  }

  enable(capability: ContainableCapability, actor: string, reason: string, at: string): AuditEvent {
    this.#disabled.delete(capability);
    const event: AuditEvent = {
      approver: actor,
      reason,
      object: capability,
      action: 'kill_switch_enable',
      outcome: 'EXECUTED',
      expiry: null,
      at,
    };
    this.#audit.push(event);
    return event;
  }

  isActive(capability: ContainableCapability): boolean {
    return !this.#disabled.has(capability);
  }

  auditTrail(): readonly AuditEvent[] {
    return [...this.#audit];
  }
}
