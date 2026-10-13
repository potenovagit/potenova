import { DomainError } from '@potenova/contracts';

/**
 * Pending-decision provenance (the substrate for every EVIDENCE-REQUIRED value).
 *
 * The mechanism is built now; the decided value is dropped in when the owner or
 * an external reviewer returns it. A value is either PENDING (awaiting that
 * decision) or CONFIGURED (a value plus who set it, when, and whether the
 * accountable owner has signed it).
 *
 * Fail-closed is the whole point: reading a pending value throws, so an unset
 * retention period / cap / threshold can never silently become a permissive
 * default, and an unsigned value can never masquerade as approved. This mirrors
 * the governance rule that EVIDENCE-REQUIRED items cannot be quietly set.
 */

export interface PendingValue {
  readonly status: 'pending';
  /** The decision this is waiting on, e.g. 'ER-07'. */
  readonly decisionId: string;
  readonly note?: string;
}

export interface ConfiguredValue<T> {
  readonly status: 'configured';
  readonly decisionId: string;
  readonly value: T;
  /** Who provided the value (reviewer / owner). */
  readonly setBy: string;
  readonly setAt: string;
  /** Signed off by the accountable owner? An unsigned value is held, not trusted. */
  readonly approved: boolean;
}

export type PolicyValue<T> = PendingValue | ConfiguredValue<T>;

export function pending(decisionId: string, note?: string): PendingValue {
  return { status: 'pending', decisionId, note };
}

export function configured<T>(
  decisionId: string,
  value: T,
  meta: { setBy: string; setAt?: string; approved?: boolean },
): ConfiguredValue<T> {
  return {
    status: 'configured',
    decisionId,
    value,
    setBy: meta.setBy,
    setAt: meta.setAt ?? new Date().toISOString(),
    approved: meta.approved ?? false,
  };
}

export function isConfigured<T>(v: PolicyValue<T>): v is ConfiguredValue<T> {
  return v.status === 'configured';
}

export function isApproved<T>(v: PolicyValue<T>): v is ConfiguredValue<T> {
  return v.status === 'configured' && v.approved;
}

/**
 * Read a policy value, fail-closed.
 *
 * @throws DomainError POLICY_BLOCKED — the value is still pending, or (when
 *   requireApproved) configured but not yet signed off.
 */
export function requireValue<T>(v: PolicyValue<T>, opts: { requireApproved?: boolean } = {}): T {
  if (v.status !== 'configured') {
    throw new DomainError(
      'POLICY_BLOCKED',
      `policy ${v.decisionId} is not configured yet (pending external decision)`,
    );
  }
  if (opts.requireApproved && !v.approved) {
    throw new DomainError(
      'POLICY_BLOCKED',
      `policy ${v.decisionId} is configured but not approved`,
    );
  }
  return v.value;
}
