import type { MathCheckReason } from './math-check';

/**
 * Deterministic scientific-notation oracle (Ontario Grade 8 B1 / exp B1.1:
 * represent numbers through scientific notation). The rule-decidable slice:
 * expand a number given in scientific notation a × 10^b into standard form,
 * where the coefficient a is carried as an integer hundredths-count (two decimal
 * places) and the exponent b is a whole number. Exact integer arithmetic — the
 * standard form is coefficientHundredths · 10^b / 100 — no floats. No model.
 *
 * Fail-closed on range AND on non-whole results: the coefficient is in proper
 * scientific-notation form, 1 ≤ a < 10 (coefficientHundredths in [100, 999]),
 * the exponent a whole number in [0, 7], and coefficientHundredths · 10^b MUST
 * be divisible by 100 so the standard form is a whole number (3.25 × 10^0 = 3.25
 * is MALFORMED here — the slice stays in whole-number standard forms). The
 * claimed value must be a non-negative integer. Anything else is MALFORMED.
 */

const isCoefficient = (n: number): boolean => Number.isInteger(n) && n >= 100 && n <= 999;
const isExponent = (n: number): boolean => Number.isInteger(n) && n >= 0 && n <= 7;

function pow10(k: number): number {
  let p = 1;
  for (let i = 0; i < k; i++) p *= 10;
  return p;
}

/** The standard-form value of coefficientHundredths/100 × 10^exponent, or null if not a whole number / out of range. */
export function scientificToStandard(
  coefficientHundredths: number,
  exponent: number,
): number | null {
  if (!isCoefficient(coefficientHundredths) || !isExponent(exponent)) return null;
  const num = coefficientHundredths * pow10(exponent);
  return num % 100 === 0 ? num / 100 : null;
}

export interface ScientificNotationTask {
  readonly kind: 'scientific_notation';
  readonly coefficientHundredths: number;
  readonly exponent: number;
  readonly claimedValue: number;
}

export interface ScientificNotationCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

export function checkScientificNotationTask(
  task: ScientificNotationTask,
): ScientificNotationCheckResult {
  if (task.kind !== 'scientific_notation') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (!(Number.isInteger(task.claimedValue) && task.claimedValue >= 0)) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const value = scientificToStandard(task.coefficientHundredths, task.exponent);
  if (value === null) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  const correct = task.claimedValue === value;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
