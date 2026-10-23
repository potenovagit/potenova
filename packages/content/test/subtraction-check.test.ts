import { describe, it, expect } from 'vitest';
import { checkSubtractionTask, type IntegerSubtractionTask } from '@potenova/content';

describe('deterministic integer-subtraction oracle (number-sense strand; CONT-001/003, NFR-07)', () => {
  it('passes a task whose claimed difference is correct', () => {
    const good: IntegerSubtractionTask = {
      kind: 'integer_subtraction',
      a: 13,
      b: 5,
      claimedDifference: 8,
    };
    expect(checkSubtractionTask(good)).toEqual({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
  });

  it('AT-20: a task with a WRONG claimed difference is detected', () => {
    const bad: IntegerSubtractionTask = {
      kind: 'integer_subtraction',
      a: 13,
      b: 5,
      claimedDifference: 2, // "smaller-from-larger" error → 5-3
    };
    const r = checkSubtractionTask(bad);
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed on a negative result (subtrahend greater than minuend)', () => {
    const negative: IntegerSubtractionTask = {
      kind: 'integer_subtraction',
      a: 3,
      b: 5,
      claimedDifference: -2,
    };
    expect(checkSubtractionTask(negative)).toEqual({
      correct: false,
      ran: false,
      reason: 'MALFORMED_TASK',
    });
  });

  it('a malformed task (negative or non-integer operand) never counts as correct', () => {
    const neg: IntegerSubtractionTask = {
      kind: 'integer_subtraction',
      a: -1,
      b: 0,
      claimedDifference: -1,
    };
    expect(checkSubtractionTask(neg).correct).toBe(false);
    expect(checkSubtractionTask(neg).ran).toBe(false);
    const fractional: IntegerSubtractionTask = {
      kind: 'integer_subtraction',
      a: 7.5,
      b: 2,
      claimedDifference: 5.5,
    };
    expect(checkSubtractionTask(fractional).correct).toBe(false);
    expect(checkSubtractionTask(fractional).ran).toBe(false);
  });

  it('grades a learner answer deterministically (no model on this path)', () => {
    // The same oracle both validates the key and grades the answer.
    expect(
      checkSubtractionTask({ kind: 'integer_subtraction', a: 9, b: 4, claimedDifference: 5 })
        .correct,
    ).toBe(true);
    expect(
      checkSubtractionTask({ kind: 'integer_subtraction', a: 9, b: 4, claimedDifference: 6 })
        .correct,
    ).toBe(false);
  });
});
