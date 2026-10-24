import { describe, it, expect } from 'vitest';
import { checkDivision2DigitTask, type Division2DigitTask } from '@potenova/content';

const d = (
  dividend: number,
  divisor: number,
  claimedQuotient: number,
  claimedRemainder: number,
): Division2DigitTask => ({
  kind: 'division_2digit',
  dividend,
  divisor,
  claimedQuotient,
  claimedRemainder,
});

describe('deterministic 3-digit ÷ 2-digit division oracle (G5 exp 13; CONT-001/003, NFR-07)', () => {
  it('passes a correct quotient-and-remainder', () => {
    expect(checkDivision2DigitTask(d(247, 12, 20, 7))).toEqual({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
    expect(checkDivision2DigitTask(d(500, 25, 20, 0)).correct).toBe(true);
  });

  it('detects the drops-the-remainder error (184 ÷ 15 answered 12 r 0)', () => {
    const r = checkDivision2DigitTask(d(184, 15, 12, 0));
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed on a one-digit divisor, a two-digit dividend, or a non-integer', () => {
    expect(checkDivision2DigitTask(d(247, 9, 27, 4)).ran).toBe(false); // divisor < 10
    expect(checkDivision2DigitTask(d(99, 12, 8, 3)).reason).toBe('MALFORMED_TASK'); // dividend < 100
    expect(checkDivision2DigitTask(d(1000, 12, 83, 4)).ran).toBe(false); // dividend > 999
  });
});
