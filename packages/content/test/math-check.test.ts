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

describe('oracle kinds for the rest of the fractions pilot (ADR-0025)', () => {
  it('partition: names shaded/parts, and rejects a wrong name', () => {
    expect(
      checkMathTask({
        kind: 'fraction_partition',
        parts: 4,
        shaded: 3,
        claimedFraction: { numerator: 3, denominator: 4 },
      }),
    ).toMatchObject({ correct: true, ran: true });
    // an equivalent form is accepted (6/8 == 3/4)
    expect(
      checkMathTask({
        kind: 'fraction_partition',
        parts: 4,
        shaded: 3,
        claimedFraction: { numerator: 6, denominator: 8 },
      }).correct,
    ).toBe(true);
    expect(
      checkMathTask({
        kind: 'fraction_partition',
        parts: 4,
        shaded: 3,
        claimedFraction: { numerator: 1, denominator: 4 },
      }),
    ).toMatchObject({ correct: false, ran: true, reason: 'ANSWER_KEY_WRONG' });
    // shaded > parts is malformed
    expect(
      checkMathTask({
        kind: 'fraction_partition',
        parts: 4,
        shaded: 5,
        claimedFraction: { numerator: 5, denominator: 4 },
      }).reason,
    ).toBe('MALFORMED_TASK');
  });

  it('unit: the unit fraction is exactly 1/d (naming, not an equivalent form)', () => {
    expect(
      checkMathTask({
        kind: 'fraction_unit',
        denominator: 5,
        claimedUnit: { numerator: 1, denominator: 5 },
      }).correct,
    ).toBe(true);
    // 2/10 is equal in value but is NOT the unit-fraction NAME for fifths
    expect(
      checkMathTask({
        kind: 'fraction_unit',
        denominator: 5,
        claimedUnit: { numerator: 2, denominator: 10 },
      }),
    ).toMatchObject({ correct: false, reason: 'ANSWER_KEY_WRONG' });
  });

  it('non-unit: m copies of 1/d make m/d, wrong count fails', () => {
    expect(
      checkMathTask({
        kind: 'fraction_nonunit_build',
        count: 3,
        unitDenominator: 5,
        claimedFraction: { numerator: 3, denominator: 5 },
      }).correct,
    ).toBe(true);
    expect(
      checkMathTask({
        kind: 'fraction_nonunit_build',
        count: 3,
        unitDenominator: 5,
        claimedFraction: { numerator: 2, denominator: 5 },
      }),
    ).toMatchObject({ correct: false, reason: 'ANSWER_KEY_WRONG' });
  });

  it('number line: exact tick, wrong tick fails, non-landing fraction is malformed', () => {
    expect(
      checkMathTask({
        kind: 'fraction_number_line',
        fraction: { numerator: 3, denominator: 4 },
        intervals: 4,
        claimedTick: 3,
      }).correct,
    ).toBe(true);
    expect(
      checkMathTask({
        kind: 'fraction_number_line',
        fraction: { numerator: 3, denominator: 4 },
        intervals: 4,
        claimedTick: 2,
      }),
    ).toMatchObject({ correct: false, reason: 'ANSWER_KEY_WRONG' });
    // 1/3 cannot land on a 4-interval line
    expect(
      checkMathTask({
        kind: 'fraction_number_line',
        fraction: { numerator: 1, denominator: 3 },
        intervals: 4,
        claimedTick: 1,
      }),
    ).toMatchObject({ ran: false, reason: 'MALFORMED_TASK' });
  });

  it('order: ascending claim passes, out-of-order fails, non-permutation is malformed', () => {
    const fractions = [
      { numerator: 1, denominator: 2 },
      { numerator: 1, denominator: 4 },
      { numerator: 3, denominator: 4 },
    ];
    // ascending is 1/4 (idx1), 1/2 (idx0), 3/4 (idx2)
    expect(
      checkMathTask({ kind: 'fraction_order', fractions, claimedOrder: [1, 0, 2] }).correct,
    ).toBe(true);
    expect(
      checkMathTask({ kind: 'fraction_order', fractions, claimedOrder: [0, 1, 2] }),
    ).toMatchObject({ correct: false, reason: 'ANSWER_KEY_WRONG' });
    expect(
      checkMathTask({ kind: 'fraction_order', fractions, claimedOrder: [0, 0, 2] }).reason,
    ).toBe('MALFORMED_TASK');
  });
});
