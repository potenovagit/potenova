import { describe, it, expect } from 'vitest';
import { isDomainError } from '@potenova/contracts';
import { pending, configured, isApproved, requireValue } from '../src/provenance';

describe('policy provenance', () => {
  it('reading a pending value fails closed', () => {
    const v = pending('ER-07', 'retention for ai_prompts');
    try {
      requireValue(v);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });

  it('a configured-but-unsigned value reads only when approval is not required', () => {
    const v = configured('ER-07', 30, { setBy: 'counsel', approved: false });
    expect(requireValue(v)).toBe(30);
    expect(isApproved(v)).toBe(false);
    try {
      requireValue(v, { requireApproved: true });
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });

  it('an approved value reads under requireApproved', () => {
    const v = configured('ER-07', 30, { setBy: 'counsel', approved: true });
    expect(isApproved(v)).toBe(true);
    expect(requireValue(v, { requireApproved: true })).toBe(30);
  });
});
