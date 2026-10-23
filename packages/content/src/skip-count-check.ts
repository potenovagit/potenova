import type { MathCheckReason } from './math-check';

/**
 * Deterministic skip-counting oracle (Ontario Grade 1 B1.5: count to 50 by 1s,
 * 2s, 5s and 10s). The learner sees the first `length` terms of a skip-count
 * sequence and gives the next term. Closed and rule-decidable: the next term is
 * computed exactly and verified before delivery, and a learner answer is graded
 * without a model.
 *
 * The allowed steps are the Grade 1 set {1, 2, 5, 10}; any other step is a
 * MALFORMED item (fail-closed) rather than silently accepted.
 */

export const SKIP_COUNT_STEPS = [1, 2, 5, 10] as const;
export type SkipCountStep = (typeof SKIP_COUNT_STEPS)[number];

export interface SkipCountTask {
  readonly kind: 'skip_count_next';
  /** First term of the shown sequence (a non-negative whole number). */
  readonly start: number;
  /** The common difference — one of 1, 2, 5, 10. */
  readonly step: number;
  /** How many terms are shown before the blank (>= 2). */
  readonly length: number;
  /** The claimed next term (an answer key, or a learner's answer). */
  readonly claimedNext: number;
}

export interface SkipCountCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;

/** The next term after `length` shown terms of start, start+step, …. */
export function skipCountNext(start: number, step: number, length: number): number {
  return start + step * length;
}

export function checkSkipCountTask(task: SkipCountTask): SkipCountCheckResult {
  if (task.kind !== 'skip_count_next') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (
    !isNonNegInt(task.start) ||
    !isNonNegInt(task.length) ||
    task.length < 2 ||
    !(SKIP_COUNT_STEPS as readonly number[]).includes(task.step) ||
    !Number.isInteger(task.claimedNext)
  ) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = skipCountNext(task.start, task.step, task.length) === task.claimedNext;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}

/** The shown sequence terms (for presenting the item). */
export function skipCountSequence(start: number, step: number, length: number): number[] {
  return Array.from({ length }, (_, i) => start + step * i);
}
