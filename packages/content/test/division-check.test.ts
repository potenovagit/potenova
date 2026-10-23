import { describe, it, expect } from 'vitest';
import { checkDivisionTask, type IntegerDivisionTask } from '@potenova/content';

const d = (dividend: number, divisor: number, claimedQuotient: number): IntegerDivisionTask => ({
  kind: 'integer_division',
  dividend,
  divisor,
  claimedQuotient,
});

describe('deterministic division-facts oracle (G3 B2.3; CONT-001/003, NFR-07)', () => {
  it('passes a correct exact fact', () => {
    expect(checkDivisionTask(d(24, 3, 8))).toEqual({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
  });

  it('detects the subtracts-instead-of-divides error (24 ÷ 3 answered 21)', () => {
    const r = checkDivisionTask(d(24, 3, 21));
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed on a zero divisor, a non-divisible pair, or out-of-range operands', () => {
    expect(checkDivisionTask(d(10, 0, 0)).ran).toBe(false); // /0
    expect(checkDivisionTask(d(10, 3, 3)).reason).toBe('MALFORMED_TASK'); // not exact
    expect(checkDivisionTask(d(120, 10, 12)).ran).toBe(false); // dividend > 100
    expect(checkDivisionTask(d(22, 11, 2)).ran).toBe(false); // divisor > 10
  });
});
