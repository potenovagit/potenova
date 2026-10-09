import { describe, it, expect } from 'vitest';
import { ConsentLedger } from '@potenova/identity';
import { isDomainError } from '@potenova/contracts';

function code(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    return isDomainError(e) ? e.code : 'OTHER';
  }
}

describe('consent ledger — F-07 taxonomy (PRIV-004, TM-46, AT-01/34)', () => {
  it('AT-01: core learning is blocked until consent is GIVEN', () => {
    const led = new ConsentLedger();
    expect(code(() => led.assertAllowed('L1', 'child_learning'))).toBe('CONSENT_REQUIRED');
    led.grant('L1', 'child_learning', 'notice-v3');
    expect(code(() => led.assertAllowed('L1', 'child_learning'))).toBeNull();
  });

  it('non-consent-basis purposes are permitted by their basis, no grant needed', () => {
    const led = new ConsentLedger();
    // child_safety (legal) and service_operations (service) are not opt-in toggles
    expect(code(() => led.assertAllowed('L1', 'child_safety'))).toBeNull();
    expect(code(() => led.assertAllowed('L1', 'service_operations'))).toBeNull();
  });

  it('optional consent-basis purposes still require a grant', () => {
    const led = new ConsentLedger();
    expect(code(() => led.assertAllowed('L1', 'voice_interaction'))).toBe('CONSENT_REQUIRED');
    led.grant('L1', 'voice_interaction', 'notice-v3');
    expect(code(() => led.assertAllowed('L1', 'voice_interaction'))).toBeNull();
  });

  it('AT-34: revoking the voice modality leaves text-based core learning intact', () => {
    const led = new ConsentLedger();
    led.grant('L1', 'child_learning', 'notice-v3'); // owns `text`
    led.grant('L1', 'voice_interaction', 'notice-v3'); // owns `voice`

    expect(led.isModalityAllowed('L1', 'voice')).toBe(true);
    expect(led.isModalityAllowed('L1', 'text')).toBe(true);

    led.revoke('L1', 'voice_interaction');

    expect(led.isModalityAllowed('L1', 'voice')).toBe(false); // voice gone
    expect(led.isModalityAllowed('L1', 'text')).toBe(true); // text remains
    expect(code(() => led.assertAllowed('L1', 'child_learning'))).toBeNull(); // core continues
  });

  it('TM-46: revoking the core learning grant fences off processing', () => {
    const led = new ConsentLedger();
    led.grant('L1', 'child_learning', 'notice-v3');
    led.revoke('L1', 'child_learning');
    expect(code(() => led.assertAllowed('L1', 'child_learning'))).toBe('CONSENT_REQUIRED');
  });

  it('rejects an unknown consent purpose at grant time', () => {
    const led = new ConsentLedger();
    // @ts-expect-error — not a member of the ConsentPurpose union
    expect(code(() => led.grant('L1', 'not_a_purpose', 'v1'))).toBe('POLICY_BLOCKED');
  });
});
