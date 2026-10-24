import { describe, it, expect } from 'vitest';
import {
  checkFractionAddSubUnlikeTask,
  fractionAddSubUnlikeResult,
  type FractionAddSubUnlikeTask,
} from '@potenova/content';

const base = {
  kind: 'fraction_addsub_unlike',
  op: '+',
} as const;

describe('deterministic unlike-denominator fraction add/subtract oracle (G6 exp 10; CONT-001/003, NFR-07)', () => {
  it('computes over the product denominator (1/2 + 1/3 = 5/6)', () => {
    expect(fractionAddSubUnlikeResult(1, 2, 1, 3, '+')).toEqual({ num: 5, denom: 6 });
    const task: FractionAddSubUnlikeTask = {
      ...base,
      leftNum: 1,
      leftDenom: 2,
      rightNum: 1,
      rightDenom: 3,
      claimedNum: 5,
      claimedDenom: 6,
    };
    expect(checkFractionAddSubUnlikeTask(task)).toMatchObject({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
  });

  it('grades by value, so an unsimplified common-denominator form is accepted (3/4 - 1/2 = 2/8)', () => {
    // 3/4 - 1/2 = (6 - 4)/8 = 2/8 = 1/4
    const asEighths: FractionAddSubUnlikeTask = {
      ...base,
      op: '-',
      leftNum: 3,
      leftDenom: 4,
      rightNum: 1,
      rightDenom: 2,
      claimedNum: 2,
      claimedDenom: 8,
    };
    const reduced: FractionAddSubUnlikeTask = { ...asEighths, claimedNum: 1, claimedDenom: 4 };
    expect(checkFractionAddSubUnlikeTask(asEighths).correct).toBe(true);
    expect(checkFractionAddSubUnlikeTask(reduced).correct).toBe(true);
  });

  it('grades the add-numerators-and-denominators error wrong (1/2 + 1/3 ≠ 2/5)', () => {
    const task: FractionAddSubUnlikeTask = {
      ...base,
      leftNum: 1,
      leftDenom: 2,
      rightNum: 1,
      rightDenom: 3,
      claimedNum: 2,
      claimedDenom: 5,
    };
    expect(checkFractionAddSubUnlikeTask(task)).toMatchObject({
      correct: false,
      ran: true,
      reason: 'ANSWER_KEY_WRONG',
    });
  });

  it('fails closed when the denominators are the same (that is the G5 like-denom skill)', () => {
    const task: FractionAddSubUnlikeTask = {
      ...base,
      leftNum: 1,
      leftDenom: 4,
      rightNum: 1,
      rightDenom: 4,
      claimedNum: 2,
      claimedDenom: 4,
    };
    expect(checkFractionAddSubUnlikeTask(task)).toMatchObject({
      ran: false,
      reason: 'MALFORMED_TASK',
    });
  });

  it('fails closed on out-of-range denominator, improper fraction, and negative result', () => {
    expect(
      checkFractionAddSubUnlikeTask({
        ...base,
        leftNum: 1,
        leftDenom: 13, // > 12
        rightNum: 1,
        rightDenom: 2,
        claimedNum: 1,
        claimedDenom: 1,
      }).ran,
    ).toBe(false);
    expect(
      checkFractionAddSubUnlikeTask({
        ...base,
        leftNum: 5,
        leftDenom: 2, // improper
        rightNum: 1,
        rightDenom: 3,
        claimedNum: 1,
        claimedDenom: 1,
      }).ran,
    ).toBe(false);
    expect(
      checkFractionAddSubUnlikeTask({
        ...base,
        op: '-',
        leftNum: 1,
        leftDenom: 3,
        rightNum: 1,
        rightDenom: 2, // 1/3 - 1/2 < 0
        claimedNum: 0,
        claimedDenom: 1,
      }).ran,
    ).toBe(false);
  });
});
