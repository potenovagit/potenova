import type { DecimalRelation, MathCheckResultLike } from './decimal-check';

/**
 * Deterministic decimal-hundredths oracles (Ontario Grade 5 B1 / exp 4, 5: read,
 * compare and order decimal numbers up to hundredths, and round a decimal to the
 * nearest tenth). Closed, rule-decidable and FLOAT-FREE: a decimal up to
 * hundredths is carried as its integer hundredths-count (value = hundredths/100),
 * so 2.47 is `hundredths: 247` and 2.5 is `hundredths: 250`. The Grade 4 tenths
 * oracles are a separate kind and are left byte-identical; this is the ×100
 * extension of the same model.
 *
 * Two task kinds:
 *   - `decimal_hundredth_compare`  compare two hundredths values (lt / eq / gt)
 *   - `decimal_round_tenth`        round a hundredths value to the nearest tenth
 *
 * Fail-closed on range: hundredths are non-negative whole numbers no greater
 * than 99999 (to 999.99). Anything else is MALFORMED.
 */

const isHundredths = (n: number): boolean => Number.isInteger(n) && n >= 0 && n <= 99999;

/** A child-readable decimal string for a hundredths-count (247 → "2.47", 250 → "2.50", 8 → "0.08"). */
export function formatHundredths(hundredths: number): string {
  const whole = Math.floor(hundredths / 100);
  const frac = hundredths % 100;
  return `${whole}.${String(frac).padStart(2, '0')}`;
}

/**
 * Parse a decimal answer string to an integer hundredths-count, or null if it is
 * not a whole number / 1–2 place decimal. "2.5" → 250, "2.47" → 247, "3" → 300.
 */
export function parseToHundredths(raw: string): number | null {
  const m = raw.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  const whole = Number(m[1]);
  const fracDigits = m[2] ?? '';
  const frac = Number((fracDigits + '00').slice(0, 2));
  return whole * 100 + frac;
}

// ── compare ──────────────────────────────────────────────────────────────────

export interface DecimalHundredthCompareTask {
  readonly kind: 'decimal_hundredth_compare';
  readonly leftHundredths: number;
  readonly rightHundredths: number;
  readonly claimedRelation: DecimalRelation;
}

export function hundredthsRelation(
  leftHundredths: number,
  rightHundredths: number,
): DecimalRelation {
  if (leftHundredths < rightHundredths) return 'lt';
  if (leftHundredths > rightHundredths) return 'gt';
  return 'eq';
}

export function checkDecimalHundredthCompareTask(
  task: DecimalHundredthCompareTask,
): MathCheckResultLike {
  if (task.kind !== 'decimal_hundredth_compare') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (
    !isHundredths(task.leftHundredths) ||
    !isHundredths(task.rightHundredths) ||
    (task.claimedRelation !== 'lt' &&
      task.claimedRelation !== 'eq' &&
      task.claimedRelation !== 'gt')
  ) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct =
    hundredthsRelation(task.leftHundredths, task.rightHundredths) === task.claimedRelation;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}

// ── round to nearest tenth ────────────────────────────────────────────────────

export interface DecimalRoundTenthTask {
  readonly kind: 'decimal_round_tenth';
  readonly hundredths: number;
  /** The claimed rounded value, also in hundredths (a multiple of 10). */
  readonly claimedHundredths: number;
}

/** Round a hundredths value to the nearest tenth, returned in hundredths (multiple of 10, half up). */
export function roundHundredthsToTenth(hundredths: number): number {
  return Math.floor((hundredths + 5) / 10) * 10;
}

export function checkDecimalRoundTenthTask(task: DecimalRoundTenthTask): MathCheckResultLike {
  if (task.kind !== 'decimal_round_tenth') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (!isHundredths(task.hundredths) || !Number.isInteger(task.claimedHundredths)) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = roundHundredthsToTenth(task.hundredths) === task.claimedHundredths;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
