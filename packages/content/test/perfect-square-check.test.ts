import { describe, it, expect } from 'vitest';
import {
  checkPerfectSquareRootTask,
  checkIsPerfectSquareTask,
  exactSqrt,
  isPerfectSquare,
} from '@potenova/content';

describe('deterministic perfect-square / square-root oracle (G7 B1.2; CONT-001/003, NFR-07)', () => {
  it('computes exact integer roots and rejects non-squares', () => {
    expect(exactSqrt(144)).toBe(12);
    expect(exactSqrt(0)).toBe(0);
    expect(exactSqrt(10000)).toBe(100);
    expect(exactSqrt(150)).toBeNull();
    expect(isPerfectSquare(81)).toBe(true);
    expect(isPerfectSquare(80)).toBe(false);
  });

  it('grades the root of a perfect square', () => {
    expect(
      checkPerfectSquareRootTask({ kind: 'perfect_square_root', square: 144, claimedRoot: 12 }),
    ).toMatchObject({ correct: true, ran: true, reason: 'ANSWER_KEY_CORRECT' });
    expect(
      checkPerfectSquareRootTask({ kind: 'perfect_square_root', square: 144, claimedRoot: 72 }),
    ).toMatchObject({ correct: false, ran: true, reason: 'ANSWER_KEY_WRONG' });
  });

  it('fails closed when asked for the root of a non-perfect-square', () => {
    expect(
      checkPerfectSquareRootTask({ kind: 'perfect_square_root', square: 150, claimedRoot: 12 }).ran,
    ).toBe(false);
  });

  it('judges whether a number is a perfect square (both directions)', () => {
    expect(
      checkIsPerfectSquareTask({ kind: 'is_perfect_square', value: 49, claimedIsSquare: true })
        .correct,
    ).toBe(true);
    expect(
      checkIsPerfectSquareTask({ kind: 'is_perfect_square', value: 50, claimedIsSquare: true })
        .correct,
    ).toBe(false);
    expect(
      checkIsPerfectSquareTask({ kind: 'is_perfect_square', value: 50, claimedIsSquare: false })
        .correct,
    ).toBe(true);
  });

  it('fails closed on out-of-range value and non-integer claim', () => {
    expect(
      checkIsPerfectSquareTask({ kind: 'is_perfect_square', value: 10001, claimedIsSquare: true })
        .ran,
    ).toBe(false);
    expect(
      checkPerfectSquareRootTask({ kind: 'perfect_square_root', square: 144, claimedRoot: 12.5 })
        .ran,
    ).toBe(false);
  });
});
