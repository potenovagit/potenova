import { describe, it, expect } from 'vitest';
import { checkFractionAddSubLikeTask, type FractionAddSubLikeTask } from '@potenova/content';

const t = (
  leftNum: number,
  rightNum: number,
  denom: number,
  op: '+' | '-',
  claimedNum: number,
  claimedDenom: number,
): FractionAddSubLikeTask => ({
  kind: 'fraction_addsub_like',
  leftNum,
  rightNum,
  denom,
  op,
  claimedNum,
  claimedDenom,
});

describe('deterministic like-denominator fraction add/subtract oracle (G5 exp 11; CONT-001/003, NFR-07)', () => {
  it('adds and subtracts over the shared denominator', () => {
    expect(checkFractionAddSubLikeTask(t(1, 2, 5, '+', 3, 5)).correct).toBe(true);
    expect(checkFractionAddSubLikeTask(t(5, 2, 6, '-', 3, 6)).correct).toBe(true);
  });

  it('accepts an equivalent form by value (3/6 as 1/2)', () => {
    expect(checkFractionAddSubLikeTask(t(5, 2, 6, '-', 1, 2)).correct).toBe(true);
  });

  it('detects the adds-the-denominators error (1/5 + 2/5 answered 3/10)', () => {
    const r = checkFractionAddSubLikeTask(t(1, 2, 5, '+', 3, 10));
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed on a negative result, a denominator out of [2,12], or a zero claimed denom', () => {
    expect(checkFractionAddSubLikeTask(t(2, 5, 6, '-', 0, 6)).reason).toBe('MALFORMED_TASK'); // 2-5 < 0
    expect(checkFractionAddSubLikeTask(t(1, 1, 20, '+', 2, 20)).ran).toBe(false); // denom > 12
    expect(checkFractionAddSubLikeTask(t(1, 2, 5, '+', 3, 0)).ran).toBe(false); // claimed denom 0
  });
});
