import { describe, it, expect } from 'vitest';
import { isDomainError } from '@potenova/contracts';
import { DRAFT_MASTERY_POLICY, assertMasteryPolicyApproved } from '../src/policy';

describe('ER-03 mastery-policy approval gate', () => {
  it('the DRAFT policy is not approved', () => {
    expect(DRAFT_MASTERY_POLICY.approved).toBe(false);
  });

  it('is advisory in non-prod (synthetic work continues)', () => {
    expect(() => assertMasteryPolicyApproved(DRAFT_MASTERY_POLICY, false)).not.toThrow();
  });

  it('fails closed in prod on an unapproved policy', () => {
    try {
      assertMasteryPolicyApproved(DRAFT_MASTERY_POLICY, true);
      expect.unreachable('should fail closed');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });

  it('passes in prod once a policy is approved', () => {
    const approved = { ...DRAFT_MASTERY_POLICY, policyVersion: 'mastery-1.0', approved: true };
    expect(() => assertMasteryPolicyApproved(approved, true)).not.toThrow();
  });
});
