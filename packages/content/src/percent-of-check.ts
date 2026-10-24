import type { MathCheckReason } from './math-check';

/**
 * Deterministic "percent of a number" oracle (Ontario Grade 6 B2 / exp 8:
 * determine a percent of a whole number). pct% of n is n·pct/100, computed by
 * exact integer arithmetic and graded by VALUE without a model.
 *
 * Fail-closed on range AND on non-integer results: the percent is a whole
 * number in [0, 100], the whole is a non-negative whole number no greater than
 * 1000, and n·pct MUST be divisible by 100 so the answer is a whole number
 * (the rule-decidable slice stays in whole-number answers — e.g. 25% of 80 = 20
 * is admitted, 25% of 81 = 20.25 is MALFORMED and never reaches a child). The
 * claimed answer must be a non-negative integer. Anything else is MALFORMED.
 */

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;

export interface PercentOfTask {
  readonly kind: 'percent_of';
  readonly percent: number;
  readonly whole: number;
  readonly claimedResult: number;
}

export interface PercentOfCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

/** pct% of n as an exact whole number, or null when it is not a whole number / out of range. */
export function percentOfResult(percent: number, whole: number): number | null {
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) return null;
  if (!isNonNegInt(whole) || whole > 1000) return null;
  const product = whole * percent;
  return product % 100 === 0 ? product / 100 : null;
}

export function checkPercentOfTask(task: PercentOfTask): PercentOfCheckResult {
  if (task.kind !== 'percent_of') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (!isNonNegInt(task.claimedResult)) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const result = percentOfResult(task.percent, task.whole);
  if (result === null) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  const correct = task.claimedResult === result;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
