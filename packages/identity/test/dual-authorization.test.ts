import { describe, it, expect } from 'vitest';
import {
  DUAL_AUTH_ACTIONS,
  isDualAuthAction,
  dualAuthRule,
  DUAL_AUTH_STATES,
} from '../src/dual-authorization';

/**
 * Dual-authorization registry (SEC-003). The default highest-risk set is the two
 * actions the requirement names; each declares the permission both parties hold.
 */
describe('dual-authorization registry', () => {
  it('defines the two spec-named highest-risk actions', () => {
    expect(Object.keys(DUAL_AUTH_ACTIONS).sort()).toEqual([
      'child_data.bulk_export',
      'safety_control.disable',
    ]);
  });

  it('recognises defined actions and rejects anything else (fail-closed)', () => {
    expect(isDualAuthAction('child_data.bulk_export')).toBe(true);
    expect(isDualAuthAction('safety_control.disable')).toBe(true);
    expect(isDualAuthAction('account.suspend')).toBe(false);
    expect(isDualAuthAction(undefined)).toBe(false);
  });

  it('each action requires a privileged permission both parties must hold', () => {
    expect(dualAuthRule('child_data.bulk_export').permission).toBe('operator:account_admin');
    expect(dualAuthRule('safety_control.disable').permission).toBe('operator:account_admin');
  });

  it('models the request lifecycle', () => {
    expect(DUAL_AUTH_STATES).toContain('PENDING');
    expect(DUAL_AUTH_STATES).toContain('CONSUMED');
    expect(DUAL_AUTH_STATES).toContain('DENIED');
    expect(DUAL_AUTH_STATES).toContain('EXPIRED');
  });
});
