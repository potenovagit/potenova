import type { MathCheckReason } from './math-check';

/**
 * Deterministic power / repeated-multiplication oracle (Ontario Grade 7 B2 /
 * exp B2.7: evaluate and express repeated multiplication of whole numbers using
 * exponential notation). base^exponent is base multiplied by itself `exponent`
 * times, computed by exact integer multiplication (no Math.pow / floats) and
 * graded by VALUE. No model.
 *
 * Fail-closed on range: base is a whole number in [0, 12], exponent a whole
 * number in [0, 6], and the exact result must not exceed 1,000,000 so the slice
 * stays in exact safe-integer arithmetic. The claimed result must be a
 * non-negative integer. Anything else is MALFORMED. (0^0 is treated as 1, the
 * standard convention for this grade.)
 */

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;
const MAX_RESULT = 1_000_000;

/** base^exponent by exact repeated multiplication, or null if out of range / over the cap. */
export function powerValue(base: number, exponent: number): number | null {
  if (!isNonNegInt(base) || base > 12) return null;
  if (!isNonNegInt(exponent) || exponent > 6) return null;
  let result = 1;
  for (let i = 0; i < exponent; i++) {
    result *= base;
    if (result > MAX_RESULT) return null;
  }
  return result;
}

export interface PowerEvalTask {
  readonly kind: 'power_eval';
  readonly base: number;
  readonly exponent: number;
  readonly claimedResult: number;
}

export interface PowerCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

export function checkPowerEvalTask(task: PowerEvalTask): PowerCheckResult {
  if (task.kind !== 'power_eval') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (!isNonNegInt(task.claimedResult)) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const value = powerValue(task.base, task.exponent);
  if (value === null) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  const correct = task.claimedResult === value;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
