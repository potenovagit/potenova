import { describe, it, expect } from 'vitest';
import {
  checkSkipCountTask,
  skipCountNext,
  skipCountSequence,
  type SkipCountTask,
} from '@potenova/content';

describe('deterministic skip-counting oracle (G1 B1.5; CONT-001/003, NFR-07)', () => {
  it('computes the next term and the shown sequence', () => {
    expect(skipCountNext(2, 2, 3)).toBe(8); // 2,4,6 → 8
    expect(skipCountSequence(5, 5, 3)).toEqual([5, 10, 15]);
    expect(skipCountNext(10, 10, 3)).toBe(40); // 10,20,30 → 40
  });

  it('passes a task whose claimed next term is correct', () => {
    const good: SkipCountTask = {
      kind: 'skip_count_next',
      start: 2,
      step: 2,
      length: 3,
      claimedNext: 8,
    };
    expect(checkSkipCountTask(good)).toEqual({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
  });

  it('AT-20: the "added one instead of the step" error is detected', () => {
    const bad: SkipCountTask = {
      kind: 'skip_count_next',
      start: 2,
      step: 2,
      length: 3,
      claimedNext: 7,
    };
    const r = checkSkipCountTask(bad);
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed on a step outside the Grade 1 set {1,2,5,10}', () => {
    const bad: SkipCountTask = {
      kind: 'skip_count_next',
      start: 0,
      step: 3,
      length: 3,
      claimedNext: 9,
    };
    expect(checkSkipCountTask(bad)).toEqual({
      correct: false,
      ran: false,
      reason: 'MALFORMED_TASK',
    });
  });

  it('fails closed on a malformed length or negative start', () => {
    expect(
      checkSkipCountTask({ kind: 'skip_count_next', start: 2, step: 2, length: 1, claimedNext: 4 })
        .ran,
    ).toBe(false);
    expect(
      checkSkipCountTask({ kind: 'skip_count_next', start: -2, step: 2, length: 3, claimedNext: 4 })
        .ran,
    ).toBe(false);
  });
});
