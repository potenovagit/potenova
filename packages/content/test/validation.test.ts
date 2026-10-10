import { describe, it, expect } from 'vitest';
import { validateCandidate, validationRecordRef, type ValidationInput } from '@potenova/content';
import { isDomainError } from '@potenova/contracts';

const base = (over: Partial<ValidationInput> = {}): ValidationInput => ({
  candidateId: 'cand-1',
  generatorId: 'model-generator-1',
  validatorId: 'validator-independent-1',
  validatorVersion: 'val-DRAFT-0.1',
  math: { ran: true, correct: true },
  safety: { available: true, pass: true },
  onTopic: true,
  ...over,
});

const at = () => '2026-10-10T00:00:00.000Z';

describe('independent validation (ADR-0006, TM-10, AT-20/21/39)', () => {
  it('TM-10: a generator cannot validate its own output', () => {
    try {
      validateCandidate(base({ validatorId: 'model-generator-1' }), at);
      throw new Error('expected POLICY_BLOCKED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });

  it('a clean candidate PASSes with a signed, referenceable record', () => {
    const r = validateCandidate(base(), at);
    expect(r.verdict).toBe('PASS');
    expect(r.reasonCodes).toContain('MATH_ANSWER_KEY_CORRECT');
    expect(validationRecordRef(r)).toBe('vr:validator-independent-1@val-DRAFT-0.1:cand-1:PASS');
  });

  it('AT-20: a wrong Math answer key FAILs validation', () => {
    const r = validateCandidate(base({ math: { ran: true, correct: false } }), at);
    expect(r.verdict).toBe('FAIL');
    expect(r.reasonCodes).toContain('MATH_ANSWER_KEY_WRONG');
  });

  it('AT-21: an unsafe conversational turn FAILs validation', () => {
    const r = validateCandidate(base({ safety: { available: true, pass: false } }), at);
    expect(r.verdict).toBe('FAIL');
    expect(r.reasonCodes).toContain('SAFETY_BLOCKED');
  });

  it('AT-21: an off-topic turn FAILs validation', () => {
    const r = validateCandidate(base({ onTopic: false }), at);
    expect(r.verdict).toBe('FAIL');
    expect(r.reasonCodes).toContain('OFF_TOPIC');
  });

  it('AT-39: safety validator outage yields UNAVAILABLE (fail-closed), never PASS', () => {
    const r = validateCandidate(base({ safety: { available: false, pass: null } }), at);
    expect(r.verdict).toBe('UNAVAILABLE');
    expect(r.reasonCodes).toContain('SAFETY_VALIDATOR_UNAVAILABLE');
  });

  it('an inconclusive safety signal yields UNCERTAIN (never delivered)', () => {
    const r = validateCandidate(base({ safety: { available: true, pass: null } }), at);
    expect(r.verdict).toBe('UNCERTAIN');
  });

  it('a wrong key wins over other passing signals (hard FAIL)', () => {
    const r = validateCandidate(
      base({ math: { ran: true, correct: false }, safety: { available: true, pass: true } }),
      at,
    );
    expect(r.verdict).toBe('FAIL');
  });
});
