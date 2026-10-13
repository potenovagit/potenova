import { describe, it, expect } from 'vitest';
import {
  emptyEscalationMatrix,
  escalationMatrixFrom,
  decideEscalation,
  type EscalationInput,
} from '../src/escalation-matrix';

const base: EscalationInput = {
  category: 'general_distress',
  severity: 'low',
  confidence: 'high',
  householdImplicated: false,
};

describe('escalation matrix (ER-08 mechanism, cells pending)', () => {
  it('an empty matrix fails closed to max containment for any input', () => {
    const m = emptyEscalationMatrix();
    const out = decideEscalation(m, base);
    expect(out.configured).toBe(false);
    expect(out.humanReview).toBe(true);
    expect(out.parentNotification).toBe('suppressed');
    expect(out.responsePattern).toBe('constrained');
    expect(out.reasonCodes).toContain('UNCONFIGURED_MAX_CONTAINMENT');
  });

  it('validator unavailable → max containment regardless of the matrix (SAFE-010)', () => {
    const m = escalationMatrixFrom(
      [
        {
          input: base,
          rule: { humanReview: false, parentNotify: 'standard', responsePattern: 'standard_safe' },
        },
      ],
      { approved: true },
    );
    const out = decideEscalation(m, base, { available: false });
    expect(out.humanReview).toBe(true);
    expect(out.reasonCodes).toContain('VALIDATOR_UNAVAILABLE');
  });

  it('a configured, approved cell is applied as the expert set it', () => {
    const m = escalationMatrixFrom(
      [
        {
          input: base,
          rule: { humanReview: false, parentNotify: 'standard', responsePattern: 'standard_safe' },
        },
      ],
      { approved: true },
    );
    const out = decideEscalation(m, base, { requireApproved: true });
    expect(out.configured).toBe(true);
    expect(out.humanReview).toBe(false);
    expect(out.parentNotification).toBe('standard');
    expect(out.responsePattern).toBe('standard_safe');
    expect(out.reasonCodes).toContain('MATRIX_RULE');
  });

  it('an unsigned cell is ignored under requireApproved (max containment)', () => {
    const m = escalationMatrixFrom(
      [
        {
          input: base,
          rule: { humanReview: false, parentNotify: 'standard', responsePattern: 'standard_safe' },
        },
      ],
      { approved: false },
    );
    const out = decideEscalation(m, base, { requireApproved: true });
    expect(out.configured).toBe(false);
    expect(out.humanReview).toBe(true);
    expect(out.reasonCodes).toContain('MATRIX_UNAPPROVED_MAX_CONTAINMENT');
  });

  it('household implication overrides a permissive cell (SAFE-006/AT-23)', () => {
    const input = { ...base, householdImplicated: true };
    const m = escalationMatrixFrom(
      [
        {
          input,
          rule: { humanReview: false, parentNotify: 'standard', responsePattern: 'standard_safe' },
        },
      ],
      { approved: true },
    );
    const out = decideEscalation(m, input, { requireApproved: true });
    expect(out.parentNotification).toBe('suppressed');
    expect(out.humanReview).toBe(true);
    expect(out.reasonCodes).toContain('HOUSEHOLD_SUPPRESS_PARENT');
  });

  it('critical severity forces constrained response + human review', () => {
    const input = { ...base, severity: 'critical' as const };
    const m = escalationMatrixFrom(
      [
        {
          input,
          rule: { humanReview: false, parentNotify: 'standard', responsePattern: 'standard_safe' },
        },
      ],
      { approved: true },
    );
    const out = decideEscalation(m, input, { requireApproved: true });
    expect(out.humanReview).toBe(true);
    expect(out.responsePattern).toBe('constrained');
    expect(out.reasonCodes).toContain('CRITICAL_FLOOR');
  });

  it('high severity floors to human review', () => {
    const input = { ...base, severity: 'high' as const };
    const m = escalationMatrixFrom(
      [
        {
          input,
          rule: { humanReview: false, parentNotify: 'standard', responsePattern: 'standard_safe' },
        },
      ],
      { approved: true },
    );
    const out = decideEscalation(m, input, { requireApproved: true });
    expect(out.humanReview).toBe(true);
    expect(out.reasonCodes).toContain('HIGH_SEVERITY_FLOOR');
  });
});
