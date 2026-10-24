import { describe, it, expect } from 'vitest';
import {
  checkParallelogramAreaTask,
  parallelogramArea,
  checkTriangleAreaTask,
} from '@potenova/content';

describe('deterministic parallelogram/triangle area oracles (G5 exp 43; CONT-001/003, NFR-07)', () => {
  it('computes parallelogram area as base × height', () => {
    expect(parallelogramArea(6, 4)).toBe(24);
    expect(
      checkParallelogramAreaTask({
        kind: 'parallelogram_area',
        base: 9,
        height: 7,
        claimedArea: 63,
      }).correct,
    ).toBe(true);
  });

  it('detects the adds-the-sides error for a parallelogram (8,8 → 16)', () => {
    expect(
      checkParallelogramAreaTask({
        kind: 'parallelogram_area',
        base: 8,
        height: 8,
        claimedArea: 16,
      }).reason,
    ).toBe('ANSWER_KEY_WRONG');
  });

  it('computes triangle area as base × height ÷ 2', () => {
    expect(
      checkTriangleAreaTask({ kind: 'triangle_area', base: 6, height: 4, claimedArea: 12 }).correct,
    ).toBe(true);
    // forgot-to-halve error
    expect(
      checkTriangleAreaTask({ kind: 'triangle_area', base: 12, height: 9, claimedArea: 108 })
        .reason,
    ).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed: a triangle with an odd base × height (non-whole area) is malformed', () => {
    expect(
      checkTriangleAreaTask({ kind: 'triangle_area', base: 3, height: 5, claimedArea: 7 }).ran,
    ).toBe(false); // 3×5 = 15 is odd
  });

  it('fails closed on a side out of [1,100] or a non-integer area', () => {
    expect(
      checkParallelogramAreaTask({ kind: 'parallelogram_area', base: 0, height: 5, claimedArea: 0 })
        .ran,
    ).toBe(false);
    expect(
      checkTriangleAreaTask({ kind: 'triangle_area', base: 6, height: 4, claimedArea: 12.5 }).ran,
    ).toBe(false);
  });
});
