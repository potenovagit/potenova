import { describe, it, expect } from 'vitest';
import { checkAdditionTask, type IntegerAdditionTask } from '@potenova/content';

describe('deterministic integer-addition oracle (number-sense strand; CONT-001/003, NFR-07)', () => {
  it('passes a task whose claimed sum is correct', () => {
    const good: IntegerAdditionTask = { kind: 'integer_addition', a: 8, b: 5, claimedSum: 13 };
    expect(checkAdditionTask(good)).toEqual({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
  });

  it('AT-20: a task with a WRONG claimed sum is detected', () => {
    const bad: IntegerAdditionTask = { kind: 'integer_addition', a: 8, b: 5, claimedSum: 12 };
    const r = checkAdditionTask(bad);
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('a malformed task (negative or non-integer operand) never counts as correct', () => {
    const negative: IntegerAdditionTask = { kind: 'integer_addition', a: -1, b: 5, claimedSum: 4 };
    expect(checkAdditionTask(negative)).toEqual({
      correct: false,
      ran: false,
      reason: 'MALFORMED_TASK',
    });
    const fractional: IntegerAdditionTask = {
      kind: 'integer_addition',
      a: 1.5,
      b: 5,
      claimedSum: 6.5,
    };
    expect(checkAdditionTask(fractional).correct).toBe(false);
    expect(checkAdditionTask(fractional).ran).toBe(false);
  });

  it('grades a learner answer deterministically (no model on this path)', () => {
    // The same oracle both validates the key and grades the answer.
    expect(checkAdditionTask({ kind: 'integer_addition', a: 3, b: 4, claimedSum: 7 }).correct).toBe(
      true,
    );
    expect(checkAdditionTask({ kind: 'integer_addition', a: 3, b: 4, claimedSum: 8 }).correct).toBe(
      false,
    );
  });
});
