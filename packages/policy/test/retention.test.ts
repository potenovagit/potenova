import { describe, it, expect } from 'vitest';
import { isDomainError } from '@potenova/contracts';
import {
  emptyRetentionPolicy,
  retentionPolicyFrom,
  evaluateRetention,
  checkRetentionReadiness,
  assertRetentionReady,
  DATA_CLASSES,
} from '../src/retention';

describe('retention policy (ER-07 mechanism, value pending)', () => {
  it('an empty policy blocks every class fail-closed (never "keep forever")', () => {
    const policy = emptyRetentionPolicy();
    for (const dc of DATA_CLASSES) {
      expect(evaluateRetention(policy, dc, 9999).action).toBe('blocked_unconfigured');
    }
  });

  it('once a class is configured, it retains then becomes due for deletion by age', () => {
    const policy = retentionPolicyFrom({
      ai_prompts: {
        rule: { activeDays: 30, backupDays: 35, deletion: 'purge' },
        setBy: 'privacy-counsel',
        approved: true,
      },
    });
    expect(evaluateRetention(policy, 'ai_prompts', 10).action).toBe('retain');
    const due = evaluateRetention(policy, 'ai_prompts', 40);
    expect(due.action).toBe('due_for_deletion');
    expect(due.deletion).toBe('purge');
    expect(due.overBy).toBe(10);
    // A class legal hasn't ruled on yet is still blocked.
    expect(evaluateRetention(policy, 'billing', 10).action).toBe('blocked_unconfigured');
  });

  it('requireApproved treats a configured-but-unsigned rule as not usable', () => {
    const policy = retentionPolicyFrom({
      billing: {
        rule: { activeDays: 365, backupDays: 400, deletion: 'tombstone' },
        setBy: 'owner',
        approved: false,
      },
    });
    expect(evaluateRetention(policy, 'billing', 10).action).toBe('retain'); // default: configured is enough
    expect(evaluateRetention(policy, 'billing', 10, { requireApproved: true }).action).toBe(
      'blocked_unconfigured',
    );
  });

  it('readiness reports the gaps', () => {
    const policy = retentionPolicyFrom({
      learner_evidence: {
        rule: { activeDays: 1000, backupDays: 1100, deletion: 'anonymize' },
        setBy: 'counsel',
        approved: true,
      },
      billing: {
        rule: { activeDays: 365, backupDays: 400, deletion: 'tombstone' },
        setBy: 'owner',
        approved: false,
      },
    });
    const r = checkRetentionReadiness(policy, ['learner_evidence', 'billing', 'analytics']);
    expect(r.ready).toBe(false);
    expect(r.unconfigured).toContain('analytics');
    expect(r.unapproved).toContain('billing');
  });

  it('assertRetentionReady throws in prod when incomplete, warns (no throw) in non-prod', () => {
    const policy = emptyRetentionPolicy();
    // non-prod: advisory
    const r = assertRetentionReady(policy, ['ai_prompts'], false);
    expect(r.ready).toBe(false);
    // prod: fail closed
    try {
      assertRetentionReady(policy, ['ai_prompts'], true);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });
});
