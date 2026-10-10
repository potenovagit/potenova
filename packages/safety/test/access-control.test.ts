import { describe, it, expect } from 'vitest';
import {
  elevate,
  isElevationActive,
  requireDualAuth,
  evaluatePrivilegedElevation,
  SecurityAuditSink,
} from '@potenova/safety';
import { isDomainError } from '@potenova/contracts';

describe('privileged access control (SEC-002/003; SAFE-017; AT-52)', () => {
  it('SEC-002: elevation is time-bound and auto-expires; standing access is denied', () => {
    const grant = elevate({ principal: 'op-1', purpose: 'investigate case sc-9', ttlMs: 1000 }, 0);
    expect(isElevationActive(grant, 500)).toBe(true);
    expect(isElevationActive(grant, 1000)).toBe(false);
    try {
      elevate({ principal: 'op-1', purpose: 'standing', ttlMs: 0 }, 0);
      throw new Error('expected POLICY_BLOCKED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });

  it('SEC-003: a highest-risk action needs two distinct approvers', () => {
    expect(() => requireDualAuth('bulk_child_data_export', 'a', 'b')).not.toThrow();
    try {
      requireDualAuth('disable_critical_safety_control', 'a', 'a');
      throw new Error('expected REVIEW_REQUIRED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('REVIEW_REQUIRED');
    }
  });

  it('AT-52: a guardian-role privileged elevation is denied and recorded in the audit sink', () => {
    const sink = new SecurityAuditSink();
    const r = evaluatePrivilegedElevation({
      requesterRole: 'owner',
      object: 'child_conversations',
      at: '2026-10-10T00:00:00Z',
    });
    sink.record(r.audit);
    expect(r.granted).toBe(false);
    expect(sink.events()).toHaveLength(1);
    expect(sink.events()[0]!.outcome).toBe('DENIED');
    expect(sink.events()[0]!.action).toBe('privileged_elevation');
  });

  it('an authorized operational role is granted', () => {
    expect(
      evaluatePrivilegedElevation({ requesterRole: 'safety_reviewer', object: 'x', at: 't' })
        .granted,
    ).toBe(true);
  });
});
