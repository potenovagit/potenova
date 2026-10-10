import { describe, it, expect } from 'vitest';
import {
  detectCase,
  triage,
  resolveCase,
  closeCase,
  assertNoClinicalConclusion,
} from '@potenova/safety';
import { isDomainError } from '@potenova/contracts';

describe('SafetyCase lifecycle (§3.8; SAFE-002/007/008)', () => {
  it('routes a low-severity case to an automated safe response', () => {
    const c = triage(detectCase('sc-1', 'low'));
    expect(c.state).toBe('AUTOMATED_SAFE_RESPONSE');
  });

  it('SAFE-007: a high-severity or ambiguous case goes to restricted human review', () => {
    expect(triage(detectCase('sc-2', 'critical')).state).toBe('RESTRICTED_REVIEW');
    expect(triage(detectCase('sc-3', 'low', true)).state).toBe('RESTRICTED_REVIEW');
  });

  it('resolves and closes', () => {
    const c = closeCase(resolveCase(triage(detectCase('sc-4', 'elevated')), 'ACTIONED'));
    expect(c.state).toBe('CLOSED');
  });

  it('SAFE-008: refuses to record a clinical conclusion', () => {
    expect(() => assertNoClinicalConclusion('observed_risk_signal')).not.toThrow();
    try {
      assertNoClinicalConclusion('clinical_conclusion');
      throw new Error('expected POLICY_BLOCKED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });
});
