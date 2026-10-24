import type { MathCheckReason } from './math-check';

/**
 * Deterministic fraction ↔ percent equivalence oracle (Ontario Grade 5 B1 /
 * exp 6: show equivalences among fractions, decimals to hundredths, and
 * whole-number percents). The rule-decidable slice checked here: is a fraction
 * p/q equal in value to a whole-number percent (pct%)? A percent is pct/100, so
 * p/q == pct/100 ⇔ p·100 == pct·q — exact integer arithmetic, graded without a
 * model.
 *
 * Fail-closed on range: the numerator is a non-negative whole number, the
 * denominator a positive whole number, and the percent a whole number in
 * [0, 100]. Anything else is MALFORMED.
 */

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;

export interface FractionPercentEquivTask {
  readonly kind: 'fraction_percent_equiv';
  readonly numerator: number;
  readonly denominator: number;
  readonly percent: number;
  readonly claimedEquivalent: boolean;
}

export interface FractionPercentCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

export function checkFractionPercentEquivTask(
  task: FractionPercentEquivTask,
): FractionPercentCheckResult {
  if (task.kind !== 'fraction_percent_equiv') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (
    !isNonNegInt(task.numerator) ||
    !Number.isInteger(task.denominator) ||
    task.denominator <= 0 ||
    !Number.isInteger(task.percent) ||
    task.percent < 0 ||
    task.percent > 100 ||
    typeof task.claimedEquivalent !== 'boolean'
  ) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  // p/q == pct/100  ⇔  p·100 == pct·q  (exact)
  const equal = task.numerator * 100 === task.percent * task.denominator;
  const correct = equal === task.claimedEquivalent;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
