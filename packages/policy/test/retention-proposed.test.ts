import { describe, it, expect } from 'vitest';
import { proposedRetentionPolicy } from '../src/retention-proposed';
import {
  evaluateRetention,
  assertRetentionReady,
  checkRetentionReadiness,
  DATA_CLASSES,
} from '../src/retention';
import { isConfigured, isApproved } from '../src/provenance';
import { isDomainError } from '@potenova/contracts';

const ALL = [...DATA_CLASSES];

describe('proposed retention schedule (ER-07, unapproved)', () => {
  it('configures every data class but none are approved', () => {
    const policy = proposedRetentionPolicy();
    for (const dc of ALL) {
      expect(isConfigured(policy[dc])).toBe(true);
      expect(isApproved(policy[dc])).toBe(false);
    }
  });

  it('is usable for non-prod work (default read ignores approval)', () => {
    const policy = proposedRetentionPolicy();
    // raw AI prompts: 30-day active retention
    expect(evaluateRetention(policy, 'ai_prompts', 10).action).toBe('retain');
    const due = evaluateRetention(policy, 'ai_prompts', 40);
    expect(due.action).toBe('due_for_deletion');
    expect(due.deletion).toBe('purge');
    // billing: ~7-year floor still retained at 1 year
    expect(evaluateRetention(policy, 'billing', 365).action).toBe('retain');
  });

  it('fails closed under requireApproved (unsigned)', () => {
    const policy = proposedRetentionPolicy();
    expect(evaluateRetention(policy, 'ai_prompts', 40, { requireApproved: true }).action).toBe(
      'blocked_unconfigured',
    );
  });

  it('is one sign-off from live: prod readiness throws until approved', () => {
    const policy = proposedRetentionPolicy();
    const readiness = checkRetentionReadiness(policy, ALL);
    expect(readiness.ready).toBe(false);
    expect(readiness.unconfigured).toHaveLength(0); // all configured…
    expect(readiness.unapproved).toEqual(expect.arrayContaining(ALL)); // …but unapproved
    try {
      assertRetentionReady(policy, ALL, true);
      expect.unreachable('should fail closed in prod');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
    // non-prod is advisory, not fatal
    expect(assertRetentionReady(policy, ALL, false).ready).toBe(false);
  });
});
