import type { MathCheckReason } from './math-check';

/**
 * Deterministic data-interpretation selection oracle (Ontario Grade 1 Data: read
 * and interpret data in a simple graph/tally — "which has the most?"). A
 * SELECTION task: the learner sees category counts and picks the category with
 * the most (or fewest).
 *
 * As with the other selections, the correct option is recomputed, not asserted:
 * the oracle finds the category attaining the extreme and only a well-posed item
 * — a UNIQUE extreme (no tie at the top/bottom) — passes the content gate. A tie
 * would be ambiguous, so it is MALFORMED and never delivered.
 *
 * Fail-closed: mode is 'most' or 'fewest', at least two categories, every count
 * a non-negative whole number, and exactly one category attains the extreme.
 */

export type GraphReadMode = 'most' | 'fewest';

export interface GraphCategory {
  readonly label: string;
  readonly count: number;
}

export interface GraphReadSelectTask {
  readonly kind: 'graph_read_select';
  readonly mode: GraphReadMode;
  readonly categories: readonly GraphCategory[];
  /** The chosen category as a 0-based index (an answer key, or a learner's pick). */
  readonly claimedIndex: number;
}

export interface GraphReadCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;

/** The index of the unique category attaining the extreme, or -1 if none/tied. */
export function extremeCategoryIndex(
  mode: GraphReadMode,
  categories: readonly GraphCategory[],
): number {
  if (categories.length === 0) return -1;
  const counts = categories.map((c) => c.count);
  const extreme = mode === 'most' ? Math.max(...counts) : Math.min(...counts);
  const atExtreme = counts.flatMap((v, i) => (v === extreme ? [i] : []));
  return atExtreme.length === 1 ? atExtreme[0]! : -1;
}

export function checkGraphReadSelectTask(task: GraphReadSelectTask): GraphReadCheckResult {
  if (task.kind !== 'graph_read_select') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  const extremeIndex = extremeCategoryIndex(task.mode, task.categories);
  const wellPosed =
    (task.mode === 'most' || task.mode === 'fewest') &&
    task.categories.length >= 2 &&
    task.categories.every((c) => isNonNegInt(c.count)) &&
    extremeIndex >= 0 &&
    Number.isInteger(task.claimedIndex) &&
    task.claimedIndex >= 0 &&
    task.claimedIndex < task.categories.length;
  if (!wellPosed) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  const correct = task.claimedIndex === extremeIndex;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
