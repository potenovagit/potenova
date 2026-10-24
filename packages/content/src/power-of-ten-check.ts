import type { MathCheckResultLike } from './decimal-check';

/**
 * Deterministic "multiply/divide by a power of ten" oracle (Ontario Grade 8 B2 /
 * exp B2.3: multiply and divide whole and decimal numbers up to thousandths by
 * powers of ten). FLOAT-FREE: the operand is carried as an integer
 * thousandths-count (value = count / 1000, up to three decimal places) and the
 * result is compared as an integer thousandths-count — exact integer
 * arithmetic, no IEEE floats. No model.
 *
 *   n × 10^k : thousandths = valueThousandths · 10^k
 *   n ÷ 10^k : thousandths = valueThousandths / 10^k
 *
 * Fail-closed on range AND on results finer than thousandths: the operand is a
 * whole thousandths-count in [0, 999999] (0.000 .. 999.999), the exponent a
 * whole number in [1, 4]; for division valueThousandths MUST be divisible by
 * 10^k so the quotient still terminates within three decimal places (0.5 ÷ 1000
 * = 0.0005 is MALFORMED and never reaches a child). The claimed
 * thousandths-count must be a non-negative integer. Anything else is MALFORMED.
 */

const isThousandths = (n: number): boolean => Number.isInteger(n) && n >= 0 && n <= 999999;
const isExponent = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= 4;

export type PowerOfTenOp = '×' | '÷';

function pow10(k: number): number {
  let p = 1;
  for (let i = 0; i < k; i++) p *= 10;
  return p;
}

/** The exact result as an integer thousandths-count, or null if out of range / finer than thousandths. */
export function powerOfTenScaleThousandths(
  op: PowerOfTenOp,
  valueThousandths: number,
  exponent: number,
): number | null {
  if (!isThousandths(valueThousandths) || !isExponent(exponent)) return null;
  const factor = pow10(exponent);
  if (op === '×') return valueThousandths * factor;
  // division: only admitted when it stays within thousandths
  return valueThousandths % factor === 0 ? valueThousandths / factor : null;
}

export interface PowerOfTenScaleTask {
  readonly kind: 'power_of_ten_scale';
  readonly op: PowerOfTenOp;
  readonly valueThousandths: number;
  readonly exponent: number;
  readonly claimedThousandths: number;
}

export function checkPowerOfTenScaleTask(task: PowerOfTenScaleTask): MathCheckResultLike {
  if (task.kind !== 'power_of_ten_scale') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (
    (task.op !== '×' && task.op !== '÷') ||
    !isThousandths(task.valueThousandths) ||
    !isExponent(task.exponent) ||
    !(Number.isInteger(task.claimedThousandths) && task.claimedThousandths >= 0)
  ) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const expected = powerOfTenScaleThousandths(task.op, task.valueThousandths, task.exponent);
  if (expected === null) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  const correct = task.claimedThousandths === expected;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
