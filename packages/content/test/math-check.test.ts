import { describe, it, expect } from 'vitest';
import {
  checkMathTask,
  trueRelation,
  areEquivalent,
  type FractionComparisonTask,
  type FractionEquivalenceTask,
} from '@potenova/content';

describe('deterministic Math correctness oracle (ADR-0006, CONT-001/003, NFR-07)', () => {
  it('computes exact fraction relations by cross-multiplication (no floats)', () => {
    expect(trueRelation({ numerator: 1, denominator: 4 }, { numerator: 1, denominator: 8 })).toBe(
      'gt',
    );
    expect(trueRelation({ numerator: 1, denominator: 3 }, { numerator: 2, denominator: 6 })).toBe(
      'eq',
    );
    expect(areEquivalent({ numerator: 2, denominator: 4 }, { numerator: 1, denominator: 2 })).toBe(
      true,
    );
  });

  it('AT-20: a comparison task with a WRONG answer key is detected', () => {
    // 1/4 > 1/8, but the generator claims "lt" (the classic denominator-size misconception).
    const bad: FractionComparisonTask = {
      kind: 'fraction_comparison',
      left: { numerator: 1, denominator: 4 },
      right: { numerator: 1, denominator: 8 },
      claimedAnswer: 'lt',
    };
    const r = checkMathTask(bad);
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('a comparison task with a correct key passes the oracle', () => {
    const good: FractionComparisonTask = {
      kind: 'fraction_comparison',
      left: { numerator: 1, denominator: 4 },
      right: { numerator: 1, denominator: 8 },
      claimedAnswer: 'gt',
    };
    expect(checkMathTask(good)).toEqual({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
  });

  it('detects a wrong equivalence key', () => {
    const bad: FractionEquivalenceTask = {
      kind: 'fraction_equivalence',
      left: { numerator: 1, denominator: 2 },
      right: { numerator: 3, denominator: 5 },
      claimedEquivalent: true,
    };
    expect(checkMathTask(bad).correct).toBe(false);
  });

  it('a malformed task (zero denominator) never counts as correct', () => {
    const malformed: FractionComparisonTask = {
      kind: 'fraction_comparison',
      left: { numerator: 1, denominator: 0 },
      right: { numerator: 1, denominator: 2 },
      claimedAnswer: 'lt',
    };
    const r = checkMathTask(malformed);
    expect(r.ran).toBe(false);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('MALFORMED_TASK');
  });
});
