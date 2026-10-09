import { describe, it, expect } from 'vitest';
import { ConsentLedger } from '@potenova/identity';
import { isDomainError } from '@potenova/contracts';

describe('consent ledger (PRIV-004, TM-46, AT-01/34)', () => {
  it('AT-01: diagnostic/tutoring processing is blocked until consent is GIVEN', () => {
    const led = new ConsentLedger();
    try {
      led.assertAllowed('L1', 'tutoring');
      throw new Error('expected CONSENT_REQUIRED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('CONSENT_REQUIRED');
    }
    led.grant('L1', 'tutoring', 'notice-v3');
    expect(() => led.assertAllowed('L1', 'tutoring')).not.toThrow();
  });

  it('AT-34: revoking one optional modality leaves core learning intact', () => {
    const led = new ConsentLedger();
    led.grant('L1', 'tutoring', 'notice-v3'); // purpose-level core consent
    led.grant('L1', 'tutoring', 'notice-v3', 'voice'); // optional voice modality
    led.grant('L1', 'tutoring', 'notice-v3', 'text');

    expect(led.isModalityAllowed('L1', 'tutoring', 'voice')).toBe(true);
    led.revoke('L1', 'tutoring', 'voice');

    // voice is gone, but text and the core purpose grant remain
    expect(led.isModalityAllowed('L1', 'tutoring', 'voice')).toBe(false);
    expect(led.isModalityAllowed('L1', 'tutoring', 'text')).toBe(true);
    expect(() => led.assertAllowed('L1', 'tutoring')).not.toThrow();
  });

  it('TM-46: revoking the purpose-level grant fences off processing', () => {
    const led = new ConsentLedger();
    led.grant('L1', 'tutoring', 'notice-v3');
    led.revoke('L1', 'tutoring');
    try {
      led.assertAllowed('L1', 'tutoring');
      throw new Error('expected CONSENT_REQUIRED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('CONSENT_REQUIRED');
    }
  });
});
