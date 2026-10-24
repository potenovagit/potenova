import type { MathCheckReason } from './math-check';

/**
 * Deterministic GCF / LCM oracle (Ontario Grade 7 B2 / exp B2.6: determine the
 * greatest common factor for whole numbers up to 144 and the lowest common
 * multiple for whole numbers). Two rule-decidable kinds, both exact-integer and
 * model-free:
 *
 *   gcf_pair  — the greatest common factor of two whole numbers (Euclid).
 *   lcm_pair  — the lowest common multiple of two whole numbers (a / gcd · b).
 *
 * Fail-closed on range: both numbers are whole numbers in [1, 144], and the
 * claimed result must be a positive integer. Anything else is MALFORMED.
 */

const inRange = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= 144;

export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x;
}

export function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b;
}

export interface GcfPairTask {
  readonly kind: 'gcf_pair';
  readonly a: number;
  readonly b: number;
  readonly claimedResult: number;
}

export interface LcmPairTask {
  readonly kind: 'lcm_pair';
  readonly a: number;
  readonly b: number;
  readonly claimedResult: number;
}

export interface GcfLcmCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

const claimOk = (n: number): boolean => Number.isInteger(n) && n >= 1;

export function checkGcfPairTask(task: GcfPairTask): GcfLcmCheckResult {
  if (task.kind !== 'gcf_pair') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (!inRange(task.a) || !inRange(task.b) || !claimOk(task.claimedResult)) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = task.claimedResult === gcd(task.a, task.b);
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}

export function checkLcmPairTask(task: LcmPairTask): GcfLcmCheckResult {
  if (task.kind !== 'lcm_pair') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (!inRange(task.a) || !inRange(task.b) || !claimOk(task.claimedResult)) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = task.claimedResult === lcm(task.a, task.b);
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
