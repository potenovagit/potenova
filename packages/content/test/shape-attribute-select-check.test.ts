import { describe, it, expect } from 'vitest';
import {
  checkShapeAttributeSelectTask,
  matchingShapeIndices,
  type ShapeAttributeSelectTask,
} from '@potenova/content';

const shapes = (...pairs: [string, number][]) => pairs.map(([name, sides]) => ({ name, sides }));

describe('deterministic shape-attribute selection oracle (G1 E1.1–E1.3; CONT-001/003)', () => {
  it('finds the one shape with the target side count (circle = 0 sides)', () => {
    expect(matchingShapeIndices(3, shapes(['triangle', 3], ['square', 4], ['circle', 0]))).toEqual([
      0,
    ]);
    expect(matchingShapeIndices(0, shapes(['triangle', 3], ['circle', 0]))).toEqual([1]);
  });

  it('passes when the learner picks the shape with that many sides', () => {
    const task: ShapeAttributeSelectTask = {
      kind: 'shape_attribute_select',
      targetSides: 3,
      options: shapes(['triangle', 3], ['square', 4], ['pentagon', 5]),
      claimedIndex: 0,
    };
    expect(checkShapeAttributeSelectTask(task)).toEqual({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
  });

  it('AT-20: picking a shape with the wrong number of sides is graded wrong', () => {
    const task: ShapeAttributeSelectTask = {
      kind: 'shape_attribute_select',
      targetSides: 3,
      options: shapes(['triangle', 3], ['square', 4], ['pentagon', 5]),
      claimedIndex: 1,
    };
    const r = checkShapeAttributeSelectTask(task);
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed on an ill-posed item: no shape (or more than one) has the target count', () => {
    const none: ShapeAttributeSelectTask = {
      kind: 'shape_attribute_select',
      targetSides: 3,
      options: shapes(['square', 4], ['pentagon', 5]),
      claimedIndex: 0,
    };
    expect(checkShapeAttributeSelectTask(none)).toEqual({
      correct: false,
      ran: false,
      reason: 'MALFORMED_TASK',
    });
    const two: ShapeAttributeSelectTask = {
      kind: 'shape_attribute_select',
      targetSides: 4,
      options: shapes(['square', 4], ['rectangle', 4], ['triangle', 3]),
      claimedIndex: 0,
    };
    expect(checkShapeAttributeSelectTask(two).ran).toBe(false);
  });

  it('fails closed on a negative side count', () => {
    expect(
      checkShapeAttributeSelectTask({
        kind: 'shape_attribute_select',
        targetSides: 3,
        options: shapes(['triangle', 3], ['weird', -1]),
        claimedIndex: 0,
      }).ran,
    ).toBe(false);
  });
});
