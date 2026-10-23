import { describe, it, expect } from 'vitest';
import { checkDivisionRemainderTask, type DivisionRemainderTask } from '@potenova/content';

const d = (
  dividend: number,
  divisor: number,
  claimedQuotient: number,
  claimedRemainder: number,
): DivisionRemainderTask => ({
  kind: 'division_with_remainder',
  dividend,
  divisor,
  claimedQuotient,
  claimedRemainder,
});

describe('deterministic division-with-remainder oracle (G4 exp 14; CONT-001/003, NFR-07)', () => {
  it('passes a correct quotient-and-remainder', () => {
    expect(checkDivisionRemainderTask(d(47, 5, 9, 2))).toEqual({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
    expect(checkDivisionRemainderTask(d(29, 6, 4, 5)).correct).toBe(true);
  });

  it('detects the drops-the-remainder error (29 ÷ 6 answered 4 r 0)', () => {
    const r = checkDivisionRemainderTask(d(29, 6, 4, 0));
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('grades a wrong quotient wrong even with a plausible remainder', () => {
    expect(checkDivisionRemainderTask(d(47, 5, 8, 7)).correct).toBe(false);
  });

  it('fails closed on a divisor outside 1–9, a dividend over 999, or a non-integer', () => {
    expect(checkDivisionRemainderTask(d(47, 0, 0, 47)).ran).toBe(false); // divisor 0
    expect(checkDivisionRemainderTask(d(1000, 3, 333, 1)).reason).toBe('MALFORMED_TASK');
    expect(checkDivisionRemainderTask(d(47, 12, 3, 11)).ran).toBe(false); // divisor > 9
  });
});
