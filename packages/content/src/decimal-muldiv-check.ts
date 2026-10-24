import type { MathCheckResultLike } from './decimal-check';

/**
 * Deterministic decimal multiply/divide oracle (Ontario Grade 7 B2 / exp B2.9:
 * multiply and divide decimal numbers by decimal numbers). FLOAT-FREE: both
 * operands are carried as integer hundredths-counts (value = count / 100, two
 * decimal places), and the result is compared as an integer TEN-THOUSANDTHS
 * count (four decimal places). All arithmetic is exact integer arithmetic — no
 * IEEE floats, no Math — so there is no rounding error. No model.
 *
 *   a × b : result (ten-thousandths) = leftHundredths · rightHundredths
 *           since (lH/100)·(rH/100) = lH·rH / 10000
 *   a ÷ b : value = lH / rH; result (ten-thousandths) = lH · 10000 / rH
 *
 * Fail-closed on range AND on non-terminating / too-precise quotients: operands
 * are whole hundredths-counts in [0, 10000] (0.00 .. 100.00); for division the
 * divisor must be > 0 AND lH·10000 must be divisible by rH, so the exact result
 * terminates within four decimal places (e.g. 1 ÷ 0.3 = 3.333… is MALFORMED and
 * never reaches a child). The claimed ten-thousandths count must be a
 * non-negative integer. Anything else is MALFORMED.
 */

export type DecimalMulDivOp = '×' | '÷';

const isHundredths = (n: number): boolean => Number.isInteger(n) && n >= 0 && n <= 10000;
const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;

/** Format an integer ten-thousandths count as a decimal string (4 dp, trailing zeros kept). */
export function formatTenThousandths(tenThousandths: number): string {
  const whole = Math.floor(tenThousandths / 10000);
  const frac = String(tenThousandths % 10000).padStart(4, '0');
  return `${whole}.${frac}`;
}

/** Parse a decimal answer string to an integer ten-thousandths count (≤ 4 dp); null if malformed. */
export function parseToTenThousandths(raw: string): number | null {
  const m = raw.trim().match(/^(\d+)(?:\.(\d{1,4}))?$/);
  if (!m) return null;
  const frac = (m[2] ?? '') + '0000';
  return Number(m[1]) * 10000 + Number(frac.slice(0, 4));
}

/** The exact result as an integer ten-thousandths count, or null if out of range / non-terminating. */
export function decimalMulDivTenThousandths(
  op: DecimalMulDivOp,
  leftHundredths: number,
  rightHundredths: number,
): number | null {
  if (!isHundredths(leftHundredths) || !isHundredths(rightHundredths)) return null;
  if (op === '×') {
    return leftHundredths * rightHundredths;
  }
  // division
  if (rightHundredths === 0) return null;
  const numerator = leftHundredths * 10000;
  if (numerator % rightHundredths !== 0) return null; // does not terminate within 4 dp
  return numerator / rightHundredths;
}

export interface DecimalMulDivTask {
  readonly kind: 'decimal_muldiv';
  readonly op: DecimalMulDivOp;
  readonly leftHundredths: number;
  readonly rightHundredths: number;
  readonly claimedTenThousandths: number;
}

export function checkDecimalMulDivTask(task: DecimalMulDivTask): MathCheckResultLike {
  if (task.kind !== 'decimal_muldiv') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (
    (task.op !== '×' && task.op !== '÷') ||
    !isHundredths(task.leftHundredths) ||
    !isHundredths(task.rightHundredths) ||
    !isNonNegInt(task.claimedTenThousandths)
  ) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const expected = decimalMulDivTenThousandths(task.op, task.leftHundredths, task.rightHundredths);
  if (expected === null) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  const correct = task.claimedTenThousandths === expected;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
