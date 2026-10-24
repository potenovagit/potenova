import { describe, it, expect } from 'vitest';
import { checkPercentOfTask, percentOfResult, type PercentOfTask } from '@potenova/content';

const base = { kind: 'percent_of' } as const;

describe('deterministic percent-of-a-number oracle (G6 exp 8; CONT-001/003, NFR-07)', () => {
  it('computes pct% of n exactly (25% of 80 = 20, 10% of 350 = 35, 100% of 7 = 7, 0% = 0)', () => {
    expect(percentOfResult(25, 80)).toBe(20);
    expect(percentOfResult(10, 350)).toBe(35);
    expect(percentOfResult(100, 7)).toBe(7);
    expect(percentOfResult(0, 500)).toBe(0);
    expect(
      checkPercentOfTask({ ...base, percent: 25, whole: 80, claimedResult: 20 }),
    ).toMatchObject({ correct: true, ran: true, reason: 'ANSWER_KEY_CORRECT' });
  });

  it('grades a wrong answer wrong (no model)', () => {
    expect(
      checkPercentOfTask({ ...base, percent: 25, whole: 80, claimedResult: 25 }),
    ).toMatchObject({ correct: false, ran: true, reason: 'ANSWER_KEY_WRONG' });
  });

  it('fails closed when the result is not a whole number (25% of 81 = 20.25)', () => {
    expect(percentOfResult(25, 81)).toBeNull();
    expect(checkPercentOfTask({ ...base, percent: 25, whole: 81, claimedResult: 20 }).ran).toBe(
      false,
    );
  });

  it('fails closed on out-of-range percent/whole and a non-integer claim', () => {
    expect(checkPercentOfTask({ ...base, percent: 150, whole: 80, claimedResult: 120 }).ran).toBe(
      false,
    );
    expect(checkPercentOfTask({ ...base, percent: 25, whole: 2000, claimedResult: 500 }).ran).toBe(
      false,
    );
    expect(checkPercentOfTask({ ...base, percent: 25, whole: 80, claimedResult: 20.5 }).ran).toBe(
      false,
    );
  });
});
