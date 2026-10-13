import { describe, it, expect } from 'vitest';
import { isDomainError } from '@potenova/contracts';
import { AGE_BANDS } from '@potenova/identity';
import {
  emptyUsageCapsPolicy,
  usageCapsPolicyFrom,
  decideUsage,
  checkUsageCapsReadiness,
  assertUsageCapsReady,
  type UsageCaps,
} from '../src/usage-caps';

// Illustrative TEST caps only — not proposed policy (ER-09 numbers are the expert's).
const juniorCaps: UsageCaps = {
  maxContinuousMinutes: 30,
  maxDailyMinutes: 60,
  breakAfterMinutes: 10,
};

describe('age-band usage caps (ER-09 mechanism, numbers pending)', () => {
  it('an empty policy blocks every band fail-closed', () => {
    const policy = emptyUsageCapsPolicy();
    for (const b of AGE_BANDS) {
      const d = decideUsage(policy, { band: b, requestedSessionMinutes: 20, usedTodayMinutes: 0 });
      expect(d.kind).toBe('BLOCKED_UNCONFIGURED');
      expect(d.allowedMinutes).toBe(0);
    }
  });

  it('allows a session within caps', () => {
    const policy = usageCapsPolicyFrom({
      junior: { caps: juniorCaps, setBy: 'child-safety-expert', approved: true },
    });
    const d = decideUsage(policy, {
      band: 'junior',
      requestedSessionMinutes: 20,
      usedTodayMinutes: 0,
    });
    expect(d.kind).toBe('ALLOW');
    expect(d.allowedMinutes).toBe(20);
    expect(d.breakAfterMinutes).toBe(10);
  });

  it('shortens to the continuous cap', () => {
    const policy = usageCapsPolicyFrom({
      junior: { caps: juniorCaps, setBy: 'x', approved: true },
    });
    const d = decideUsage(policy, {
      band: 'junior',
      requestedSessionMinutes: 45,
      usedTodayMinutes: 0,
    });
    expect(d.kind).toBe('SHORTEN');
    expect(d.allowedMinutes).toBe(30);
    expect(d.reasonCodes).toContain('LIMITED_BY_CONTINUOUS_CAP');
  });

  it('stops when the daily cap is reached', () => {
    const policy = usageCapsPolicyFrom({
      junior: { caps: juniorCaps, setBy: 'x', approved: true },
    });
    const d = decideUsage(policy, {
      band: 'junior',
      requestedSessionMinutes: 20,
      usedTodayMinutes: 60,
    });
    expect(d.kind).toBe('STOP');
    expect(d.allowedMinutes).toBe(0);
    expect(d.reasonCodes).toContain('DAILY_CAP_REACHED');
  });

  it('a parent can tighten below the safety cap', () => {
    const policy = usageCapsPolicyFrom({
      junior: { caps: juniorCaps, setBy: 'x', approved: true },
    });
    const d = decideUsage(policy, {
      band: 'junior',
      requestedSessionMinutes: 25,
      usedTodayMinutes: 0,
      parentCaps: { maxContinuousMinutes: 15 },
    });
    expect(d.kind).toBe('SHORTEN');
    expect(d.allowedMinutes).toBe(15);
    expect(d.reasonCodes).toContain('PARENT_LIMIT_APPLIED');
  });

  it('a parent cannot exceed the safety cap (attempt ignored)', () => {
    const policy = usageCapsPolicyFrom({
      junior: { caps: juniorCaps, setBy: 'x', approved: true },
    });
    const d = decideUsage(policy, {
      band: 'junior',
      requestedSessionMinutes: 120,
      usedTodayMinutes: 0,
      parentCaps: { maxContinuousMinutes: 120, maxDailyMinutes: 240 },
    });
    expect(d.allowedMinutes).toBe(30); // safety cap wins
    expect(d.reasonCodes).toContain('PARENT_EXCEEDS_SAFETY_IGNORED');
  });

  it('an unsigned cap is rejected under requireApproved', () => {
    const policy = usageCapsPolicyFrom({
      junior: { caps: juniorCaps, setBy: 'x', approved: false },
    });
    const d = decideUsage(policy, {
      band: 'junior',
      requestedSessionMinutes: 20,
      usedTodayMinutes: 0,
      requireApproved: true,
    });
    expect(d.kind).toBe('BLOCKED_UNCONFIGURED');
  });

  it('prod readiness fails closed until every band has an approved cap', () => {
    const policy = emptyUsageCapsPolicy();
    expect(checkUsageCapsReadiness(policy).ready).toBe(false);
    try {
      assertUsageCapsReady(policy, true);
      expect.unreachable('should fail closed in prod');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
    expect(assertUsageCapsReady(policy, false).ready).toBe(false); // advisory in non-prod
  });

  it('rejects malformed minute inputs', () => {
    const policy = usageCapsPolicyFrom({
      junior: { caps: juniorCaps, setBy: 'x', approved: true },
    });
    try {
      decideUsage(policy, { band: 'junior', requestedSessionMinutes: -5, usedTodayMinutes: 0 });
      expect.unreachable('should reject');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });
});
