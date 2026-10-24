import { describe, it, expect } from 'vitest';
import { checkMult2x2Task, type Mult2x2Task } from '@potenova/content';

const m = (factorA: number, factorB: number, claimedProduct: number): Mult2x2Task => ({
  kind: 'mult_2x2',
  factorA,
  factorB,
  claimedProduct,
});

describe('deterministic 2-digit × 2-digit multiplication oracle (G5 exp 12; CONT-001/003, NFR-07)', () => {
  it('passes correct products', () => {
    expect(checkMult2x2Task(m(23, 45, 1035)).correct).toBe(true);
    expect(checkMult2x2Task(m(50, 60, 3000)).correct).toBe(true);
  });

  it('detects a partial-product error (27 × 19 answered 133 — ones digit only)', () => {
    const r = checkMult2x2Task(m(27, 19, 133));
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed on a factor outside [10,99] or a non-integer', () => {
    expect(checkMult2x2Task(m(9, 45, 405)).ran).toBe(false); // single-digit
    expect(checkMult2x2Task(m(100, 12, 1200)).reason).toBe('MALFORMED_TASK'); // three-digit
    expect(checkMult2x2Task(m(23, 45, 1035.5)).ran).toBe(false);
  });
});
