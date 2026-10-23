import type { MathCheckReason } from './math-check';

/**
 * Deterministic decimal-tenths oracles (Ontario Grade 4 B1 / exp 6, 7, 8:
 * read, compare and order decimal tenths; round a decimal to the nearest whole;
 * and relate fractions to decimal tenths). Closed and rule-decidable — and
 * FLOAT-FREE: a decimal tenth is carried as its integer tenths-count
 * (value = tenths / 10), so 2.3 is `tenths: 23`. Every comparison, rounding and
 * equivalence is exact integer arithmetic, graded without a model.
 *
 * Three task kinds share this representation:
 *   - `decimal_tenth_compare`   compare two tenths (lt / eq / gt)
 *   - `decimal_round_whole`     round a tenths value to the nearest whole number
 *   - `fraction_decimal_equiv`  is a fraction equal in value to a decimal tenth?
 *
 * Fail-closed on range: tenths are non-negative whole numbers no greater than
 * 9999 (to 999.9); a fraction has a positive denominator and non-negative
 * numerator. Anything else is MALFORMED.
 */

export type DecimalRelation = 'lt' | 'eq' | 'gt';

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;
const isTenths = (n: number): boolean => isNonNegInt(n) && n <= 9999;

/** A child-readable decimal string for a tenths-count (e.g. 23 → "2.3", 40 → "4.0"). */
export function formatTenths(tenths: number): string {
  return `${Math.floor(tenths / 10)}.${tenths % 10}`;
}

// ── compare ────────────────────────────────────────────────────────────────

export interface DecimalCompareTask {
  readonly kind: 'decimal_tenth_compare';
  readonly leftTenths: number;
  readonly rightTenths: number;
  readonly claimedRelation: DecimalRelation;
}

export interface MathCheckResultLike {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

/** Ground-truth relation of two tenths values — exact integer compare. */
export function decimalRelation(leftTenths: number, rightTenths: number): DecimalRelation {
  if (leftTenths < rightTenths) return 'lt';
  if (leftTenths > rightTenths) return 'gt';
  return 'eq';
}

export function checkDecimalCompareTask(task: DecimalCompareTask): MathCheckResultLike {
  if (task.kind !== 'decimal_tenth_compare') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (
    !isTenths(task.leftTenths) ||
    !isTenths(task.rightTenths) ||
    (task.claimedRelation !== 'lt' &&
      task.claimedRelation !== 'eq' &&
      task.claimedRelation !== 'gt')
  ) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = decimalRelation(task.leftTenths, task.rightTenths) === task.claimedRelation;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}

// ── round to nearest whole ───────────────────────────────────────────────────

export interface DecimalRoundTask {
  readonly kind: 'decimal_round_whole';
  readonly tenths: number;
  readonly claimedWhole: number;
}

/** Round a tenths value to the nearest whole number, half rounding up. */
export function roundTenthsToWhole(tenths: number): number {
  return Math.floor((tenths + 5) / 10);
}

export function checkDecimalRoundTask(task: DecimalRoundTask): MathCheckResultLike {
  if (task.kind !== 'decimal_round_whole') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (!isTenths(task.tenths) || !Number.isInteger(task.claimedWhole)) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = roundTenthsToWhole(task.tenths) === task.claimedWhole;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}

// ── fraction ↔ decimal-tenth equivalence ─────────────────────────────────────

export interface FractionDecimalEquivTask {
  readonly kind: 'fraction_decimal_equiv';
  readonly numerator: number;
  readonly denominator: number;
  readonly tenths: number;
  readonly claimedEquivalent: boolean;
}

export function checkFractionDecimalEquivTask(task: FractionDecimalEquivTask): MathCheckResultLike {
  if (task.kind !== 'fraction_decimal_equiv') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (
    !isNonNegInt(task.numerator) ||
    !Number.isInteger(task.denominator) ||
    task.denominator <= 0 ||
    !isTenths(task.tenths) ||
    typeof task.claimedEquivalent !== 'boolean'
  ) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  // numerator/denominator == tenths/10  ⇔  numerator*10 == tenths*denominator (exact)
  const equal = task.numerator * 10 === task.tenths * task.denominator;
  const correct = equal === task.claimedEquivalent;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
