import { describe, it, expect } from 'vitest';
import { isDomainError } from '@potenova/contracts';
import {
  planErasure,
  recordTargetOutcome,
  verifyErasure,
  assertErasureComplete,
  DEFAULT_ERASURE_TARGETS,
  type ErasureScope,
} from '../src/deletion';

const scope: ErasureScope = {
  subjectType: 'learner',
  subjectId: 'syn-learner-1',
  reason: 'account_closure',
  requestedAt: '2026-10-13T00:00:00Z',
};

const at = '2026-10-13T00:05:00Z';

describe('deletion-propagation verification (PRIV-005)', () => {
  it('a fresh plan is incomplete — every required store is outstanding', () => {
    const rec = planErasure(scope);
    const v = verifyErasure(rec);
    expect(v.complete).toBe(false);
    expect(v.outstanding).toEqual(
      expect.arrayContaining([
        'first_party_store',
        'analytics',
        'provider:azure_openai',
        'backups',
      ]),
    );
  });

  it('is complete only when every required target reaches a success state', () => {
    let rec = planErasure(scope);
    rec = recordTargetOutcome(rec, 'first_party_store', 'completed', { at });
    rec = recordTargetOutcome(rec, 'analytics', 'completed', { at });
    // provider stores nothing under modified abuse monitoring — attested, not assumed
    rec = recordTargetOutcome(rec, 'provider:azure_openai', 'not_applicable', { at });
    // backups are tombstoned, not purged (NFR-17)
    rec = recordTargetOutcome(rec, 'backups', 'tombstoned', { at });

    const v = verifyErasure(rec);
    expect(v.complete).toBe(true);
    expect(v.outstanding).toHaveLength(0);
    expect(() => assertErasureComplete(rec)).not.toThrow();
  });

  it('a failed target keeps the erasure incomplete and blocks the done-assertion', () => {
    let rec = planErasure(scope);
    rec = recordTargetOutcome(rec, 'first_party_store', 'completed', { at });
    rec = recordTargetOutcome(rec, 'analytics', 'completed', { at });
    rec = recordTargetOutcome(rec, 'provider:azure_openai', 'not_applicable', { at });
    rec = recordTargetOutcome(rec, 'backups', 'failed', { at, note: 'backup job error' });

    expect(verifyErasure(rec).complete).toBe(false);
    try {
      assertErasureComplete(rec);
      expect.unreachable('should block');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });

  it('a plan that forgets a required store still fails closed', () => {
    // Only the first-party target — someone forgot backups/analytics/provider.
    const rec = planErasure(scope, [DEFAULT_ERASURE_TARGETS[0]]);
    const done = recordTargetOutcome(rec, 'first_party_store', 'completed', { at });
    const v = verifyErasure(done);
    expect(v.complete).toBe(false);
    expect(v.outstanding).toEqual(
      expect.arrayContaining(['analytics', 'provider:azure_openai', 'backups']),
    );
  });

  it('recording an unknown target is rejected', () => {
    const rec = planErasure(scope);
    try {
      recordTargetOutcome(rec, 'provider:unknown', 'completed');
      expect.unreachable('should reject');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('NOT_FOUND');
    }
  });
});
