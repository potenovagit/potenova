import { describe, it, expect } from 'vitest';
import {
  checkFractionalGroupsTask,
  fractionalGroupCount,
  type FractionalGroupsTask,
} from '@potenova/content';

const g = (
  wholes: number,
  unitDenominator: number,
  claimedCount: number,
): FractionalGroupsTask => ({
  kind: 'fractional_groups',
  wholes,
  unitDenominator,
  claimedCount,
});

describe('deterministic fractional-groups oracle (G3 exp 13; CONT-001/003, NFR-07)', () => {
  it('counts unit-fraction pieces as wholes × denominator', () => {
    expect(fractionalGroupCount(3, 2)).toBe(6); // halves in 3 wholes
    expect(fractionalGroupCount(2, 4)).toBe(8); // fourths in 2 wholes
    expect(fractionalGroupCount(4, 3)).toBe(12); // thirds in 4 wholes
  });

  it('passes a correct count', () => {
    expect(checkFractionalGroupsTask(g(3, 2, 6))).toEqual({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
  });

  it('detects the counts-the-wholes error (halves in 5 wholes answered 5)', () => {
    const r = checkFractionalGroupsTask(g(5, 2, 5));
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed on a denominator below 2, zero wholes, or an out-of-range denominator', () => {
    expect(checkFractionalGroupsTask(g(3, 1, 3)).ran).toBe(false); // denominator < 2 (not a unit fraction)
    expect(checkFractionalGroupsTask(g(0, 2, 0)).reason).toBe('MALFORMED_TASK'); // wholes < 1
    expect(checkFractionalGroupsTask(g(2, 13, 26)).ran).toBe(false); // denominator > 12
  });
});
