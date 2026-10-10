import { describe, it, expect } from 'vitest';
import {
  subjectEntitled,
  withinSeatLimit,
  grantEntitlementCredit,
  postCutoffAccess,
  childAvailabilityView,
  assertNoPricingInChildView,
  type FamilyTier,
} from '@potenova/billing';
import { isDomainError } from '@potenova/contracts';

const mathOnly: FamilyTier = {
  tierId: 't-math',
  subjects: ['math'],
  childSeatLimit: 2,
  term: 'annual',
};

describe('tiers (BILL-001/002)', () => {
  it('only purchased subjects are entitled', () => {
    expect(subjectEntitled(mathOnly, 'math')).toBe(true);
    expect(subjectEntitled(mathOnly, 'english')).toBe(false);
  });

  it('seat usage is bounded by the tier child count', () => {
    expect(withinSeatLimit(mathOnly, 2)).toBe(true);
    expect(withinSeatLimit(mathOnly, 3)).toBe(false);
  });
});

describe('credits (BILL-011)', () => {
  it('requires privileged actor + reason, independent of any store transaction', () => {
    const c = grantEntitlementCredit({
      actor: 'op-1',
      reason: 'goodwill after outage',
      expiresAt: '2026-12-01',
    });
    expect(c.independentOfStoreTransaction).toBe(true);
    for (const [actor, reason, code] of [
      ['', 'r', 'FORBIDDEN_ROLE'],
      ['op-1', '', 'REVIEW_REQUIRED'],
    ] as const) {
      try {
        grantEntitlementCredit({ actor, reason, expiresAt: 'x' });
        throw new Error('expected ' + code);
      } catch (e) {
        expect(isDomainError(e) && e.code).toBe(code);
      }
    }
  });
});

describe('post-cutoff access + child view (BILL-007/012; AT-45)', () => {
  it('AT-45: after expiry learning is read-only but export/deletion remain', () => {
    const a = postCutoffAccess('PAID_EXPIRED');
    expect(a.learningActive).toBe(false);
    expect(a.learningReadOnly).toBe(true);
    expect(a.exportAvailable).toBe(true);
    expect(a.deletionAvailable).toBe(true);
  });

  it('BILL-007: child view never shows pricing; lapsed entitlement shows a neutral message', () => {
    expect(childAvailabilityView('PAID_ACTIVE')).toEqual({
      showsPricing: false,
      message: 'available',
    });
    expect(childAvailabilityView('PAID_EXPIRED')).toEqual({
      showsPricing: false,
      message: 'ask_a_parent',
    });
    try {
      assertNoPricingInChildView({ showsPricing: true });
      throw new Error('expected POLICY_BLOCKED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });
});
