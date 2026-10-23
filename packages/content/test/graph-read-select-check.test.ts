import { describe, it, expect } from 'vitest';
import {
  checkGraphReadSelectTask,
  extremeCategoryIndex,
  type GraphReadSelectTask,
} from '@potenova/content';

const cats = (...pairs: [string, number][]) => pairs.map(([label, count]) => ({ label, count }));

describe('deterministic data-interpretation selection oracle (G1 Data; CONT-001/003)', () => {
  it('recomputes the unique extreme category', () => {
    expect(extremeCategoryIndex('most', cats(['a', 5], ['b', 3], ['c', 2]))).toBe(0);
    expect(extremeCategoryIndex('fewest', cats(['a', 5], ['b', 3], ['c', 2]))).toBe(2);
    expect(extremeCategoryIndex('most', cats(['a', 5], ['b', 5]))).toBe(-1); // tie → none
  });

  it('passes when the learner picks the most/fewest category', () => {
    const task: GraphReadSelectTask = {
      kind: 'graph_read_select',
      mode: 'most',
      categories: cats(['apples', 5], ['bananas', 3], ['cherries', 2]),
      claimedIndex: 0,
    };
    expect(checkGraphReadSelectTask(task)).toEqual({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
  });

  it('AT-20: answering "most" with the fewest category is graded wrong', () => {
    const task: GraphReadSelectTask = {
      kind: 'graph_read_select',
      mode: 'most',
      categories: cats(['apples', 5], ['bananas', 3], ['cherries', 2]),
      claimedIndex: 2,
    };
    const r = checkGraphReadSelectTask(task);
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed on an ambiguous item: a tie at the extreme', () => {
    const tie: GraphReadSelectTask = {
      kind: 'graph_read_select',
      mode: 'most',
      categories: cats(['a', 6], ['b', 6], ['c', 2]),
      claimedIndex: 0,
    };
    expect(checkGraphReadSelectTask(tie)).toEqual({
      correct: false,
      ran: false,
      reason: 'MALFORMED_TASK',
    });
  });

  it('fails closed on a negative count or a single category', () => {
    expect(
      checkGraphReadSelectTask({
        kind: 'graph_read_select',
        mode: 'most',
        categories: cats(['a', -1], ['b', 2]),
        claimedIndex: 1,
      }).ran,
    ).toBe(false);
    expect(
      checkGraphReadSelectTask({
        kind: 'graph_read_select',
        mode: 'most',
        categories: cats(['a', 2]),
        claimedIndex: 0,
      }).ran,
    ).toBe(false);
  });
});
