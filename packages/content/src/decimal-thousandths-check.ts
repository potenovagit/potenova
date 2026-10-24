import type { DecimalRelation, MathCheckResultLike } from './decimal-check';

/**
 * Deterministic decimal-thousandths oracles (Ontario Grade 6 B1 / exp 3, 4:
 * read, compare and order decimals up to thousandths, and round decimals to the
 * nearest tenth, hundredth or whole). Closed, rule-decidable and FLOAT-FREE: a
 * decimal up to thousandths is carried as its integer thousandths-count
 * (value = thousandths/1000), so 2.475 is `thousandths: 2475` and 2.5 is 2500.
 * The ×1000 extension of the G4 tenths / G5 hundredths model; those oracles are
 * separate kinds and stay byte-identical.
 *
 * Two task kinds:
 *   - `decimal_thousandth_compare`  compare two thousandths values (lt/eq/gt)
 *   - `decimal_round_hundredth`     round a thousandths value to the nearest hundredth
 *
 * Fail-closed on range: thousandths are non-negative whole numbers no greater
 * than 999999 (to 999.999). Anything else is MALFORMED.
 */

const isThousandths = (n: number): boolean => Number.isInteger(n) && n >= 0 && n <= 999999;

/** A child-readable decimal string for a thousandths-count (2475 → "2.475", 2500 → "2.500", 8 → "0.008"). */
export function formatThousandths(thousandths: number): string {
  const whole = Math.floor(thousandths / 1000);
  const frac = thousandths % 1000;
  return `${whole}.${String(frac).padStart(3, '0')}`;
}

/** Parse a decimal answer string to an integer thousandths-count (1–3 places), or null. */
export function parseToThousandths(raw: string): number | null {
  const m = raw.trim().match(/^(\d+)(?:\.(\d{1,3}))?$/);
  if (!m) return null;
  const whole = Number(m[1]);
  const fracDigits = m[2] ?? '';
  const frac = Number((fracDigits + '000').slice(0, 3));
  return whole * 1000 + frac;
}

// ── compare ──────────────────────────────────────────────────────────────────

export interface DecimalThousandthCompareTask {
  readonly kind: 'decimal_thousandth_compare';
  readonly leftThousandths: number;
  readonly rightThousandths: number;
  readonly claimedRelation: DecimalRelation;
}

export function thousandthsRelation(
  leftThousandths: number,
  rightThousandths: number,
): DecimalRelation {
  if (leftThousandths < rightThousandths) return 'lt';
  if (leftThousandths > rightThousandths) return 'gt';
  return 'eq';
}

export function checkDecimalThousandthCompareTask(
  task: DecimalThousandthCompareTask,
): MathCheckResultLike {
  if (task.kind !== 'decimal_thousandth_compare') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (
    !isThousandths(task.leftThousandths) ||
    !isThousandths(task.rightThousandths) ||
    (task.claimedRelation !== 'lt' &&
      task.claimedRelation !== 'eq' &&
      task.claimedRelation !== 'gt')
  ) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct =
    thousandthsRelation(task.leftThousandths, task.rightThousandths) === task.claimedRelation;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}

// ── round to nearest hundredth ───────────────────────────────────────────────

export interface DecimalRoundHundredthTask {
  readonly kind: 'decimal_round_hundredth';
  readonly thousandths: number;
  /** The claimed rounded value, also in thousandths (a multiple of 10). */
  readonly claimedThousandths: number;
}

/** Round a thousandths value to the nearest hundredth, in thousandths (multiple of 10, half up). */
export function roundThousandthsToHundredth(thousandths: number): number {
  return Math.floor((thousandths + 5) / 10) * 10;
}

export function checkDecimalRoundHundredthTask(
  task: DecimalRoundHundredthTask,
): MathCheckResultLike {
  if (task.kind !== 'decimal_round_hundredth') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (!isThousandths(task.thousandths) || !Number.isInteger(task.claimedThousandths)) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = roundThousandthsToHundredth(task.thousandths) === task.claimedThousandths;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
