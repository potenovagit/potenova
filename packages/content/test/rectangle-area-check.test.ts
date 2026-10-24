import { describe, it, expect } from 'vitest';
import {
  checkRectangleAreaTask,
  rectangleArea,
  checkRectangleMissingSideTask,
} from '@potenova/content';

describe('deterministic rectangle-area oracles (G4 exp 41/42; CONT-001/003, NFR-07)', () => {
  it('computes area as length × width', () => {
    expect(rectangleArea(6, 4)).toBe(24);
    expect(
      checkRectangleAreaTask({ kind: 'rectangle_area', length: 8, width: 8, claimedArea: 64 }),
    ).toMatchObject({ correct: true, ran: true, reason: 'ANSWER_KEY_CORRECT' });
  });

  it('detects the adds-the-sides error (8 by 8 answered 16)', () => {
    const r = checkRectangleAreaTask({
      kind: 'rectangle_area',
      length: 8,
      width: 8,
      claimedArea: 16,
    });
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('finds the missing side by exact division', () => {
    expect(
      checkRectangleMissingSideTask({
        kind: 'rectangle_missing_side',
        area: 24,
        knownSide: 6,
        claimedSide: 4,
      }).correct,
    ).toBe(true);
    // multiply-instead-of-divide error
    expect(
      checkRectangleMissingSideTask({
        kind: 'rectangle_missing_side',
        area: 24,
        knownSide: 6,
        claimedSide: 144,
      }).reason,
    ).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed on a side out of [1,100], an area that the side does not divide, or a non-integer', () => {
    expect(
      checkRectangleAreaTask({ kind: 'rectangle_area', length: 0, width: 5, claimedArea: 0 }).ran,
    ).toBe(false);
    expect(
      checkRectangleMissingSideTask({
        kind: 'rectangle_missing_side',
        area: 25,
        knownSide: 4,
        claimedSide: 6,
      }).reason,
    ).toBe('MALFORMED_TASK'); // 25 not divisible by 4
    expect(
      checkRectangleAreaTask({ kind: 'rectangle_area', length: 6, width: 4, claimedArea: 24.5 })
        .ran,
    ).toBe(false);
  });
});
