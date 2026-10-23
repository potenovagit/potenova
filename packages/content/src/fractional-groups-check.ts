import type { MathCheckReason } from './math-check';

/**
 * Deterministic fractional-groups oracle (Ontario Grade 3 B2.x / exp 13:
 * represent and solve problems involving groups of one half, one third and one
 * fourth). The rule-decidable slice: how many unit-fraction pieces of size
 * 1/`unitDenominator` are in `wholes` whole units? The answer is the exact
 * integer `wholes × unitDenominator` (e.g. how many fourths in 3 wholes = 12).
 * Graded without a model.
 *
 * This is a DISTINCT task kind kept in its own file — the seven fraction oracles
 * in `math-check.ts` (partition, unit, non-unit build, number-line, equivalence,
 * comparison, order) are left byte-identical. A curriculum review (ER-03) may
 * later fold this skill into the fractions graph.
 *
 * Fail-closed on range: `wholes` is a whole number ≥ 1, `unitDenominator` is a
 * whole number in [2, 12] (a genuine unit fraction — halves, thirds, fourths …),
 * and the claimed count is an integer. Anything else is MALFORMED.
 */

export interface FractionalGroupsTask {
  readonly kind: 'fractional_groups';
  /** The number of whole units. */
  readonly wholes: number;
  /** The denominator of the unit fraction (2 = halves, 3 = thirds, 4 = fourths …). */
  readonly unitDenominator: number;
  /** The claimed count of unit-fraction pieces (an answer key, or a learner's answer). */
  readonly claimedCount: number;
}

export interface FractionalGroupsCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

/** The exact number of 1/unitDenominator pieces in `wholes` whole units. */
export function fractionalGroupCount(wholes: number, unitDenominator: number): number {
  return wholes * unitDenominator;
}

export function checkFractionalGroupsTask(task: FractionalGroupsTask): FractionalGroupsCheckResult {
  if (task.kind !== 'fractional_groups') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  const wellPosed =
    Number.isInteger(task.wholes) &&
    task.wholes >= 1 &&
    Number.isInteger(task.unitDenominator) &&
    task.unitDenominator >= 2 &&
    task.unitDenominator <= 12 &&
    Number.isInteger(task.claimedCount);
  if (!wellPosed) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  const correct = fractionalGroupCount(task.wholes, task.unitDenominator) === task.claimedCount;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
