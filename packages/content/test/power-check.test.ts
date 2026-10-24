import { describe, it, expect } from 'vitest';
import { checkPowerEvalTask, powerValue } from '@potenova/content';

const base = { kind: 'power_eval' } as const;

describe('deterministic power / repeated-multiplication oracle (G7 B2.7; CONT-001/003, NFR-07)', () => {
  it('evaluates powers by exact repeated multiplication', () => {
    expect(powerValue(2, 5)).toBe(32);
    expect(powerValue(10, 3)).toBe(1000);
    expect(powerValue(7, 2)).toBe(49);
    expect(powerValue(5, 0)).toBe(1);
    expect(powerValue(0, 0)).toBe(1); // convention
    expect(powerValue(1, 6)).toBe(1);
    expect(checkPowerEvalTask({ ...base, base: 2, exponent: 5, claimedResult: 32 })).toMatchObject({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
  });

  it('grades the "multiplied base by exponent" error wrong (2^5 ≠ 10)', () => {
    expect(checkPowerEvalTask({ ...base, base: 2, exponent: 5, claimedResult: 10 })).toMatchObject({
      correct: false,
      ran: true,
      reason: 'ANSWER_KEY_WRONG',
    });
  });

  it('fails closed over the safe-integer cap and out of range', () => {
    expect(powerValue(12, 6)).toBeNull(); // 2,985,984 > 1,000,000
    expect(checkPowerEvalTask({ ...base, base: 12, exponent: 6, claimedResult: 2985984 }).ran).toBe(
      false,
    );
    expect(checkPowerEvalTask({ ...base, base: 13, exponent: 2, claimedResult: 169 }).ran).toBe(
      false,
    );
    expect(checkPowerEvalTask({ ...base, base: 2, exponent: 7, claimedResult: 128 }).ran).toBe(
      false,
    );
  });

  it('fails closed on a non-integer claim', () => {
    expect(checkPowerEvalTask({ ...base, base: 2, exponent: 5, claimedResult: 32.5 }).ran).toBe(
      false,
    );
  });
});
