import { describe, it, expect } from 'vitest';
import { checkMultiplicationTask, type IntegerMultiplicationTask } from '@potenova/content';

const m = (a: number, b: number, claimedProduct: number): IntegerMultiplicationTask => ({
  kind: 'integer_multiplication',
  a,
  b,
  claimedProduct,
});

describe('deterministic multiplication-facts oracle (G3 B2.4; CONT-001/003, NFR-07)', () => {
  it('passes a correct fact', () => {
    expect(checkMultiplicationTask(m(8, 3, 24))).toEqual({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
  });

  it('detects the adds-instead-of-multiplies error (8 × 3 answered 11)', () => {
    const r = checkMultiplicationTask(m(8, 3, 11));
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('grades the zero and identity facts', () => {
    expect(checkMultiplicationTask(m(0, 7, 0)).correct).toBe(true);
    expect(checkMultiplicationTask(m(1, 9, 9)).correct).toBe(true);
    expect(checkMultiplicationTask(m(10, 10, 100)).correct).toBe(true);
  });

  it('fails closed on a factor past the 10×10 table, a negative, or a non-integer', () => {
    expect(checkMultiplicationTask(m(11, 2, 22)).ran).toBe(false); // factor > 10
    expect(checkMultiplicationTask(m(-2, 3, -6)).reason).toBe('MALFORMED_TASK');
    expect(
      checkMultiplicationTask({ kind: 'integer_multiplication', a: 2, b: 3, claimedProduct: 6.5 })
        .ran,
    ).toBe(false);
  });
});
