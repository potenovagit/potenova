import { describe, it, expect } from 'vitest';
import { startTrial, expireTrial, DRAFT_BILLING_POLICY } from '@potenova/billing';
import { isDomainError } from '@potenova/contracts';

describe('card-free trial (BILL-005/006/013; AT-41)', () => {
  it('AT-41: starts card-free and never auto-converts', () => {
    const t = startTrial({
      parentContactVerified: true,
      priorTrialsForContact: 0,
      maxTrialsPerContact: 1,
    });
    expect(t.state).toBe('TRIAL_ACTIVE');
    expect(t.requiresCard).toBe(false);
    expect(t.autoConverts).toBe(false);
  });

  it('ER-01: the policy carries no invented price, trial-day or token limit', () => {
    expect(DRAFT_BILLING_POLICY.priceByTerm.monthly).toBeNull();
    expect(DRAFT_BILLING_POLICY.priceByTerm.annual).toBeNull();
    expect(DRAFT_BILLING_POLICY.trialDayLimit).toBeNull();
    expect(DRAFT_BILLING_POLICY.trialTokenLimit).toBeNull();
  });

  it('expiry pauses tutoring, preserves the profile, keeps upgrade parent-only', () => {
    const e = expireTrial();
    expect(e.state).toBe('TRIAL_EXPIRED');
    expect(e.profilePreserved).toBe(true);
    expect(e.upgradeParentOnly).toBe(true);
  });

  it('BILL-013: rate-limits trials per verified parent contact; requires verification', () => {
    try {
      startTrial({ parentContactVerified: true, priorTrialsForContact: 1, maxTrialsPerContact: 1 });
      throw new Error('expected RATE_LIMITED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('RATE_LIMITED');
    }
    try {
      startTrial({
        parentContactVerified: false,
        priorTrialsForContact: 0,
        maxTrialsPerContact: 1,
      });
      throw new Error('expected AUTH_REQUIRED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('AUTH_REQUIRED');
    }
  });
});
