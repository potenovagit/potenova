import { describe, it, expect } from 'vitest';
import { transitionEntitlement, canTransitionEntitlement, learningActive } from '@potenova/billing';
import { isDomainError } from '@potenova/contracts';

describe('entitlement lifecycle (§3.7; BILL-008/009)', () => {
  it('learning is active in trial, paid, grace and scheduled-cancel; inactive once expired', () => {
    expect(learningActive('TRIAL_ACTIVE')).toBe(true);
    expect(learningActive('PAID_ACTIVE')).toBe(true);
    expect(learningActive('PAST_DUE_GRACE')).toBe(true);
    expect(learningActive('CANCEL_SCHEDULED')).toBe(true);
    expect(learningActive('TRIAL_EXPIRED')).toBe(false);
    expect(learningActive('PAID_EXPIRED')).toBe(false);
    expect(learningActive('INACTIVE')).toBe(false);
  });

  it('re-applying the current state is an idempotent no-op (BILL-008)', () => {
    expect(transitionEntitlement('PAID_ACTIVE', 'PAID_ACTIVE')).toBe('PAID_ACTIVE');
    expect(canTransitionEntitlement('PAID_ACTIVE', 'PAID_ACTIVE')).toBe(true);
  });

  it('rejects an illegal transition', () => {
    try {
      transitionEntitlement('TRIAL_ACTIVE', 'PAST_DUE_GRACE');
      throw new Error('expected CONFLICT');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('CONFLICT');
    }
  });
});
