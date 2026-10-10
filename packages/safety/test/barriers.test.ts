import { describe, it, expect } from 'vitest';
import {
  assertNoBillingFromChildSession,
  assertEvalDataAllowed,
  residencyBarrier,
} from '@potenova/safety';
import { isDomainError } from '@potenova/contracts';

describe('hard access barriers (AT-24/51/55)', () => {
  it('AT-24: billing is never reachable from a child session', () => {
    try {
      assertNoBillingFromChildSession();
      throw new Error('expected FORBIDDEN_ROLE');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('FORBIDDEN_ROLE');
    }
  });

  it('AT-51: production child history is refused for evaluation; replay kinds allowed', () => {
    expect(() => assertEvalDataAllowed('synthetic_replay')).not.toThrow();
    expect(() => assertEvalDataAllowed('deidentified_replay')).not.toThrow();
    try {
      assertEvalDataAllowed('production_child_history');
      throw new Error('expected POLICY_BLOCKED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });

  it('AT-55: a disallowed region is refused with a safe notice, Canadian regions allowed', () => {
    expect(residencyBarrier('ca-central').kind).toBe('ALLOW');
    const denied = residencyBarrier('us-east-1');
    expect(denied).toEqual({ kind: 'DENY', reason: 'REGION_DISALLOWED', safeNotice: true });
  });
});
