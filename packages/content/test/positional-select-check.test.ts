import { describe, it, expect } from 'vitest';
import {
  checkPositionalSelectTask,
  relationHolds,
  matchingPositionalIndices,
  type PositionalSelectTask,
  type PositionalScene,
} from '@potenova/content';

const scene = (sr: number, sc: number, rr: number, rc: number): PositionalScene => ({
  subject: { r: sr, c: sc },
  reference: { r: rr, c: rc },
});

describe('deterministic positional-language selection oracle (G1 E1.4; CONT-001/003)', () => {
  it('recomputes the relation with screen coordinates', () => {
    expect(relationHolds('above', scene(0, 1, 2, 1))).toBe(true); // smaller row = higher
    expect(relationHolds('below', scene(0, 1, 2, 1))).toBe(false);
    expect(relationHolds('left_of', scene(0, 0, 0, 2))).toBe(true);
    expect(relationHolds('right_of', scene(0, 0, 0, 2))).toBe(false);
  });

  it('finds the one scene that satisfies the relation', () => {
    const options = [scene(0, 1, 2, 1), scene(2, 1, 0, 1), scene(1, 0, 1, 2)];
    expect(matchingPositionalIndices('above', options)).toEqual([0]);
  });

  it('passes when the learner picks the scene matching the relation', () => {
    const task: PositionalSelectTask = {
      kind: 'positional_select',
      relation: 'above',
      options: [scene(0, 1, 2, 1), scene(2, 1, 0, 1), scene(1, 0, 1, 2)],
      claimedIndex: 0,
    };
    expect(checkPositionalSelectTask(task)).toEqual({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
  });

  it('AT-20: the reversed-relation distractor (below, for above) is graded wrong', () => {
    const task: PositionalSelectTask = {
      kind: 'positional_select',
      relation: 'above',
      options: [scene(0, 1, 2, 1), scene(2, 1, 0, 1), scene(1, 0, 1, 2)],
      claimedIndex: 1,
    };
    const r = checkPositionalSelectTask(task);
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed on an ill-posed item: no scene (or more than one) satisfies', () => {
    const none: PositionalSelectTask = {
      kind: 'positional_select',
      relation: 'above',
      options: [scene(2, 1, 0, 1), scene(1, 0, 1, 2)], // below, same-row
      claimedIndex: 0,
    };
    expect(checkPositionalSelectTask(none)).toEqual({
      correct: false,
      ran: false,
      reason: 'MALFORMED_TASK',
    });
    const two: PositionalSelectTask = {
      kind: 'positional_select',
      relation: 'above',
      options: [scene(0, 0, 2, 0), scene(0, 1, 1, 1)], // both above
      claimedIndex: 0,
    };
    expect(checkPositionalSelectTask(two).ran).toBe(false);
  });
});
