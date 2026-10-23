import { describe, it, expect } from 'vitest';
import {
  checkWholeNumberTask,
  wholeRelation,
  type IntegerComparisonTask,
  type IntegerOrderingTask,
} from '@potenova/content';

describe('deterministic whole-number compare/order oracle (number sense; CONT-001/003, NFR-07)', () => {
  it('computes the exact relation of two whole numbers', () => {
    expect(wholeRelation(12, 21)).toBe('lt');
    expect(wholeRelation(34, 29)).toBe('gt');
    expect(wholeRelation(40, 40)).toBe('eq');
  });

  it('passes a comparison whose claimed relation is correct', () => {
    const good: IntegerComparisonTask = {
      kind: 'integer_comparison',
      a: 12,
      b: 21,
      claimedRelation: 'lt',
    };
    expect(checkWholeNumberTask(good)).toEqual({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
  });

  it('AT-20: the "ones-digit / longer-is-bigger" error is detected', () => {
    // 12 vs 21: judging by the leading/greater ones digit says 12 > 21 — wrong.
    const bad: IntegerComparisonTask = {
      kind: 'integer_comparison',
      a: 12,
      b: 21,
      claimedRelation: 'gt',
    };
    const r = checkWholeNumberTask(bad);
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('a malformed comparison (negative / non-integer / bad relation) never counts as correct', () => {
    expect(
      checkWholeNumberTask({
        kind: 'integer_comparison',
        a: -1,
        b: 2,
        claimedRelation: 'lt',
      }),
    ).toEqual({ correct: false, ran: false, reason: 'MALFORMED_TASK' });
    expect(
      checkWholeNumberTask({
        kind: 'integer_comparison',
        a: 2.5,
        b: 2,
        claimedRelation: 'gt',
      }).ran,
    ).toBe(false);
  });

  it('grades an ascending ordering with ties allowed', () => {
    const good: IntegerOrderingTask = {
      kind: 'integer_ordering',
      numbers: [23, 8, 41],
      claimedOrder: [1, 0, 2], // 8 < 23 < 41
    };
    expect(checkWholeNumberTask(good).correct).toBe(true);

    const wrong: IntegerOrderingTask = {
      kind: 'integer_ordering',
      numbers: [23, 8, 41],
      claimedOrder: [0, 1, 2], // 23, 8, 41 — not ascending
    };
    expect(checkWholeNumberTask(wrong).correct).toBe(false);
    expect(checkWholeNumberTask(wrong).reason).toBe('ANSWER_KEY_WRONG');
  });

  it('a malformed ordering (wrong length / duplicate / out-of-range index) is rejected', () => {
    const dup: IntegerOrderingTask = {
      kind: 'integer_ordering',
      numbers: [5, 9, 2],
      claimedOrder: [0, 0, 1],
    };
    expect(checkWholeNumberTask(dup)).toEqual({
      correct: false,
      ran: false,
      reason: 'MALFORMED_TASK',
    });
    const short: IntegerOrderingTask = {
      kind: 'integer_ordering',
      numbers: [5, 9, 2],
      claimedOrder: [2, 0],
    };
    expect(checkWholeNumberTask(short).ran).toBe(false);
  });
});
