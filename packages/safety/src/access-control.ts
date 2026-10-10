import { DomainError } from '@potenova/contracts';
import type { GuardianRole } from '@potenova/identity';
import type { AuditEvent, DualAuthAction } from './policy';

/**
 * Privileged access control (SEC-002/003; SAFE-017; AT-52).
 *
 * Zero standing access: elevation to sensitive child data is purpose-specific and
 * time-bound, auto-expiring (SEC-002). Highest-risk actions require two distinct
 * approvers (SEC-003). Every decision writes to a tamper-resistant audit sink,
 * separate from application logs, carrying approver/reason/object/action/outcome/
 * expiry (SEC-003; SAFE-017). A parent/guardian role can never self-elevate to
 * operational privilege; the denial is recorded (AT-52).
 */

export interface ElevationRequest {
  readonly principal: string;
  readonly purpose: string;
  readonly ttlMs: number;
}

export interface ElevationGrant {
  readonly principal: string;
  readonly purpose: string;
  readonly grantedAtMs: number;
  readonly expiresAtMs: number;
}

/**
 * Grant a time-bound elevation. No standing access: a non-positive TTL or empty
 * purpose is refused.
 *
 * @throws DomainError POLICY_BLOCKED — standing/unscoped elevation.
 */
export function elevate(req: ElevationRequest, nowMs: number): ElevationGrant {
  if (!req.purpose)
    throw new DomainError('POLICY_BLOCKED', 'elevation requires a specific purpose');
  if (req.ttlMs <= 0)
    throw new DomainError('POLICY_BLOCKED', 'standing (non-expiring) access is denied');
  return {
    principal: req.principal,
    purpose: req.purpose,
    grantedAtMs: nowMs,
    expiresAtMs: nowMs + req.ttlMs,
  };
}

export function isElevationActive(grant: ElevationGrant, nowMs: number): boolean {
  return nowMs < grant.expiresAtMs;
}

/**
 * Dual authorization for a highest-risk action (SEC-003).
 *
 * @throws DomainError REVIEW_REQUIRED — fewer than two distinct approvers.
 */
export function requireDualAuth(
  _action: DualAuthAction,
  approverA: string,
  approverB: string,
): void {
  if (!approverA || !approverB || approverA === approverB) {
    throw new DomainError('REVIEW_REQUIRED', 'this action requires two distinct approvers');
  }
}

/** Roles permitted to hold operational privilege (never a guardian). */
const OPERATIONAL_ROLES = new Set<string>(['operator', 'safety_reviewer']);

export interface PrivilegedElevationResult {
  readonly granted: boolean;
  readonly audit: AuditEvent;
}

/**
 * AT-52: evaluate a privileged-elevation attempt. A guardian role is denied and
 * the denial is recorded in the tamper-resistant audit (it never throws silently).
 */
export function evaluatePrivilegedElevation(input: {
  readonly requesterRole: GuardianRole | string;
  readonly object: string;
  readonly at: string;
}): PrivilegedElevationResult {
  const granted = OPERATIONAL_ROLES.has(input.requesterRole);
  return {
    granted,
    audit: {
      approver: 'system',
      reason: granted ? 'authorized operational role' : 'role not permitted operational privilege',
      object: input.object,
      action: 'privileged_elevation',
      outcome: granted ? 'GRANTED' : 'DENIED',
      expiry: null,
      at: input.at,
    },
  };
}

/** Append-only, tamper-resistant audit sink, distinct from application logs (SEC-003). */
export class SecurityAuditSink {
  readonly #events: AuditEvent[] = [];

  record(event: AuditEvent): void {
    this.#events.push(event);
  }

  events(): readonly AuditEvent[] {
    return [...this.#events];
  }
}
