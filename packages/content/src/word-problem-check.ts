import type { MathCheckReason } from './math-check';

/**
 * Deterministic word-problem oracle (Ontario Grade 1 B2.4/B2.5: represent and
 * solve addition and subtraction situations). The STORY is authored from a
 * template with known quantities and a known operation, so there is no free-text
 * comprehension to model — the oracle just computes the templated operation and
 * grades the learner's number. The narrative itself lives with the item (a
 * presentation concern); this checks only the arithmetic it stands for.
 *
 * Fail-closed on range: both quantities and the result are non-negative whole
 * numbers (a subtraction that would go negative is MALFORMED — Grade 1 stays in
 * whole numbers), and the operation is '+' or '-'.
 */

export type WordOp = '+' | '-';

export interface WordProblemTask {
  readonly kind: 'word_problem';
  readonly a: number;
  readonly b: number;
  readonly op: WordOp;
  /** The claimed answer (an answer key, or a learner's answer). */
  readonly claimed: number;
}

export interface WordProblemCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;

/** The whole-number result of the templated situation, or null if out of range. */
export function wordProblemResult(a: number, op: WordOp, b: number): number | null {
  if (!isNonNegInt(a) || !isNonNegInt(b)) return null;
  if (op !== '+' && op !== '-') return null;
  const v = op === '+' ? a + b : a - b;
  return v >= 0 ? v : null;
}

export function checkWordProblemTask(task: WordProblemTask): WordProblemCheckResult {
  if (task.kind !== 'word_problem') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  const result = wordProblemResult(task.a, task.op, task.b);
  if (result === null || !Number.isInteger(task.claimed)) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = result === task.claimed;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
