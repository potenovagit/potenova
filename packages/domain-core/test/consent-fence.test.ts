import { describe, it, expect } from 'vitest';
import { assertProcessingAllowed, type ConsentGrant } from '@potenova/domain-core';
import { isDomainError } from '@potenova/contracts';

const given: ConsentGrant = { purpose: 'tutoring', state: 'GIVEN', noticeVersion: 'v3' };

describe('consent fence (PRIV-004, TM-46, AT-01/34)', () => {
  it('allows processing with an active matching grant', () => {
    expect(() => assertProcessingAllowed('tutoring', [given])).not.toThrow();
  });

  it('blocks processing with no grant (AT-01: no AI before consent)', () => {
    try {
      assertProcessingAllowed('tutoring', []);
      throw new Error('expected CONSENT_REQUIRED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('CONSENT_REQUIRED');
    }
  });

  it('blocks processing after revocation (TM-46 revocation fence)', () => {
    const revoked: ConsentGrant = { ...given, state: 'REVOKED' };
    try {
      assertProcessingAllowed('tutoring', [revoked]);
      throw new Error('expected CONSENT_REQUIRED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('CONSENT_REQUIRED');
    }
  });

  it('allows deletion even without a consent grant (narrow documented exception)', () => {
    expect(() => assertProcessingAllowed('deletion', [])).not.toThrow();
  });
});
