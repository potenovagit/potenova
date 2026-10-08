import { describe, it, expect } from 'vitest';
import { decideDelivery, type CandidateContent } from '@potenova/domain-core';
import { isDomainError } from '@potenova/contracts';

const pass: CandidateContent = {
  candidateId: 'cand-1',
  verdict: 'PASS',
  validationRecordRef: 'val-rec-1',
};
const fallback = { assetId: 'approved-fallback-1' };

describe('child content delivery gate (AI-001, TM-09/10/40, AT-20/21/39)', () => {
  it('delivers only a PASS backed by a signed validation record', () => {
    expect(decideDelivery(pass, fallback)).toEqual({ kind: 'DELIVER', candidateId: 'cand-1' });
  });

  it('never delivers a PASS without a signed record', () => {
    try {
      decideDelivery({ ...pass, validationRecordRef: null }, fallback);
      throw new Error('expected POLICY_BLOCKED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });

  it.each(['FAIL', 'UNCERTAIN'] as const)('serves fallback (not the candidate) on %s', (v) => {
    expect(decideDelivery({ ...pass, verdict: v }, fallback)).toEqual({
      kind: 'FALLBACK',
      assetId: 'approved-fallback-1',
    });
  });

  it('blocks when validation is UNAVAILABLE and no fallback exists (AT-39 fail-closed)', () => {
    expect(decideDelivery({ ...pass, verdict: 'UNAVAILABLE' }, null)).toEqual({
      kind: 'BLOCK',
      reason: 'VALIDATION_UNAVAILABLE',
    });
  });

  it('blocks (not delivers) on FAIL when no fallback exists', () => {
    expect(decideDelivery({ ...pass, verdict: 'FAIL' }, null)).toEqual({
      kind: 'BLOCK',
      reason: 'SAFETY_BLOCKED',
    });
  });
});
