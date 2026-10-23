import { describe, it, expect } from 'vitest';
import {
  checkMultidigitMultiplicationTask,
  type MultidigitMultiplicationTask,
} from '@potenova/content';

const m = (
  multiplicand: number,
  multiplier: number,
  claimedProduct: number,
): MultidigitMultiplicationTask => ({
  kind: 'multidigit_multiplication',
  multiplicand,
  multiplier,
  claimedProduct,
});

describe('deterministic multi-digit multiplication oracle (G4 exp 13; CONT-001/003, NFR-07)', () => {
  it('passes correct 2–3 digit × 1-digit and × power-of-ten products', () => {
    expect(checkMultidigitMultiplicationTask(m(34, 6, 204)).correct).toBe(true);
    expect(checkMultidigitMultiplicationTask(m(125, 3, 375)).correct).toBe(true);
    expect(checkMultidigitMultiplicationTask(m(47, 100, 4700)).correct).toBe(true);
  });

  it('detects the multiplies-only-the-ones-digit error (28 × 5 answered 40)', () => {
    const r = checkMultidigitMultiplicationTask(m(28, 5, 40));
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed on a bad multiplier, a multiplicand over 9999, or a non-integer', () => {
    expect(checkMultidigitMultiplicationTask(m(34, 7000, 238000)).ran).toBe(false); // 7000 not an allowed multiplier
    expect(checkMultidigitMultiplicationTask(m(10000, 3, 30000)).reason).toBe('MALFORMED_TASK');
    expect(
      checkMultidigitMultiplicationTask({
        kind: 'multidigit_multiplication',
        multiplicand: 12,
        multiplier: 3,
        claimedProduct: 36.5,
      }).ran,
    ).toBe(false);
  });
});
