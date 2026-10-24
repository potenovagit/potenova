import { describe, it, expect } from 'vitest';
import {
  checkFractionMulDivTask,
  fractionMulDivResult,
  type FractionMulDivTask,
} from '@potenova/content';

const base = { kind: 'fraction_muldiv' } as const;

describe('deterministic fraction multiply/divide oracle (G7 B2.8; CONT-001/003, NFR-07)', () => {
  it('multiplies numerators and denominators (2/3 × 3/4 = 6/12 = 1/2)', () => {
    expect(fractionMulDivResult(2, 3, 3, 4, '×')).toEqual({ num: 6, denom: 12 });
    const asIs: FractionMulDivTask = {
      ...base,
      op: '×',
      leftNum: 2,
      leftDenom: 3,
      rightNum: 3,
      rightDenom: 4,
      claimedNum: 6,
      claimedDenom: 12,
    };
    const reduced: FractionMulDivTask = { ...asIs, claimedNum: 1, claimedDenom: 2 };
    expect(checkFractionMulDivTask(asIs).correct).toBe(true);
    expect(checkFractionMulDivTask(reduced).correct).toBe(true);
  });

  it('divides by multiplying by the reciprocal (1/2 ÷ 3/4 = 4/6 = 2/3)', () => {
    expect(fractionMulDivResult(1, 2, 3, 4, '÷')).toEqual({ num: 4, denom: 6 });
    expect(
      checkFractionMulDivTask({
        ...base,
        op: '÷',
        leftNum: 1,
        leftDenom: 2,
        rightNum: 3,
        rightDenom: 4,
        claimedNum: 2,
        claimedDenom: 3,
      }),
    ).toMatchObject({ correct: true, ran: true, reason: 'ANSWER_KEY_CORRECT' });
  });

  it('grades the "divided straight across" error wrong (1/2 ÷ 3/4 ≠ 1/2·3/... )', () => {
    // A learner who multiplies instead of using the reciprocal gets 3/8, not 2/3.
    expect(
      checkFractionMulDivTask({
        ...base,
        op: '÷',
        leftNum: 1,
        leftDenom: 2,
        rightNum: 3,
        rightDenom: 4,
        claimedNum: 3,
        claimedDenom: 8,
      }),
    ).toMatchObject({ correct: false, ran: true, reason: 'ANSWER_KEY_WRONG' });
  });

  it('fails closed on divide-by-zero, out-of-range denominators, and improper fractions', () => {
    expect(
      checkFractionMulDivTask({
        ...base,
        op: '÷',
        leftNum: 1,
        leftDenom: 2,
        rightNum: 0,
        rightDenom: 4, // divisor is 0/4 = 0
        claimedNum: 1,
        claimedDenom: 1,
      }).ran,
    ).toBe(false);
    expect(
      checkFractionMulDivTask({
        ...base,
        op: '×',
        leftNum: 1,
        leftDenom: 13, // > 12
        rightNum: 1,
        rightDenom: 2,
        claimedNum: 1,
        claimedDenom: 26,
      }).ran,
    ).toBe(false);
    expect(
      checkFractionMulDivTask({
        ...base,
        op: '×',
        leftNum: 5,
        leftDenom: 2, // improper
        rightNum: 1,
        rightDenom: 2,
        claimedNum: 5,
        claimedDenom: 4,
      }).ran,
    ).toBe(false);
  });
});
