import { describe, it, expect } from 'vitest';
import { checkSqrtBetweenTask, floorSqrt } from '@potenova/content';

const base = { kind: 'sqrt_between' } as const;

describe('deterministic square-root estimation oracle (G8 B1.3; CONT-001/003, NFR-07)', () => {
  it('computes the integer floor of a square root exactly', () => {
    expect(floorSqrt(50)).toBe(7); // 7² = 49 ≤ 50 < 64
    expect(floorSqrt(99)).toBe(9); // 9² = 81 ≤ 99 < 100
    expect(floorSqrt(2)).toBe(1);
  });

  it('accepts the correct lower bound (√50 is between 7 and 8)', () => {
    expect(checkSqrtBetweenTask({ ...base, value: 50, claimedLower: 7 })).toMatchObject({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
  });

  it('grades the wrong neighbour wrong (√50 is not between 6 and 7)', () => {
    expect(checkSqrtBetweenTask({ ...base, value: 50, claimedLower: 6 })).toMatchObject({
      correct: false,
      ran: true,
      reason: 'ANSWER_KEY_WRONG',
    });
  });

  it('grades the "halved it" error wrong (√50 ≠ between 25 and 26)', () => {
    expect(checkSqrtBetweenTask({ ...base, value: 50, claimedLower: 25 }).correct).toBe(false);
  });

  it('fails closed on a perfect square (that is the exact-root skill) and out of range', () => {
    expect(checkSqrtBetweenTask({ ...base, value: 49, claimedLower: 7 }).ran).toBe(false);
    expect(checkSqrtBetweenTask({ ...base, value: 1, claimedLower: 1 }).ran).toBe(false); // below range
    expect(checkSqrtBetweenTask({ ...base, value: 10001, claimedLower: 100 }).ran).toBe(false);
  });
});
