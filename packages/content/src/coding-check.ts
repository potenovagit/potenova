import type { MathCheckReason } from './math-check';

/**
 * Deterministic coding oracle (Ontario Grade 1 C3.1/C3.2: write, execute and
 * read simple sequential programs). A SELECTION task: a robot starts on a small
 * grid and must reach a goal cell; the learner picks the program (a sequence of
 * moves) that gets it there. The oracle EXECUTES each candidate program on the
 * grid and recomputes which one lands exactly on the goal — no model.
 *
 * Grid convention: row 0 is the top, column 0 is the left; `up` decreases the
 * row, `down` increases it, `left`/`right` move the column. A program that steps
 * off the grid does not reach the goal. Only a well-posed item — exactly one
 * option lands on the goal — is delivered.
 */

export const MOVES = ['up', 'down', 'left', 'right'] as const;
export type Move = (typeof MOVES)[number];

export interface Cell {
  readonly r: number;
  readonly c: number;
}

export interface CodeReachSelectTask {
  readonly kind: 'code_reach_select';
  readonly rows: number;
  readonly cols: number;
  readonly start: Cell;
  readonly goal: Cell;
  readonly options: readonly (readonly Move[])[];
  /** The chosen program as a 0-based index (an answer key, or a learner's pick). */
  readonly claimedIndex: number;
}

export interface CodingCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

const isPosInt = (n: number): boolean => Number.isInteger(n) && n > 0;
const onGrid = (cell: Cell, rows: number, cols: number): boolean =>
  cell.r >= 0 && cell.r < rows && cell.c >= 0 && cell.c < cols;

/** Run a program from `start`; returns the end cell, or null if it steps off the grid. */
export function runProgram(
  start: Cell,
  moves: readonly Move[],
  rows: number,
  cols: number,
): Cell | null {
  let cur: Cell = start;
  for (const m of moves) {
    cur =
      m === 'up'
        ? { r: cur.r - 1, c: cur.c }
        : m === 'down'
          ? { r: cur.r + 1, c: cur.c }
          : m === 'left'
            ? { r: cur.r, c: cur.c - 1 }
            : { r: cur.r, c: cur.c + 1 };
    if (!onGrid(cur, rows, cols)) return null;
  }
  return cur;
}

/** The grid and programs of a reach task, without the learner's pick — enough to
 *  recompute the key. */
export type CodeReachGrid = Pick<
  CodeReachSelectTask,
  'rows' | 'cols' | 'start' | 'goal' | 'options'
>;

/** Indices of the programs that land exactly on the goal (the oracle's own key). */
export function reachingProgramIndices(task: CodeReachGrid): number[] {
  return task.options.flatMap((prog, i) => {
    const end = runProgram(task.start, prog, task.rows, task.cols);
    return end && end.r === task.goal.r && end.c === task.goal.c ? [i] : [];
  });
}

export function checkCodeReachSelectTask(task: CodeReachSelectTask): CodingCheckResult {
  if (task.kind !== 'code_reach_select') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  const shapeOk =
    isPosInt(task.rows) &&
    isPosInt(task.cols) &&
    onGrid(task.start, task.rows, task.cols) &&
    onGrid(task.goal, task.rows, task.cols) &&
    task.options.length >= 2 &&
    task.options.every((p) => p.every((m) => (MOVES as readonly string[]).includes(m)));
  const wellPosed =
    shapeOk &&
    reachingProgramIndices(task).length === 1 &&
    Number.isInteger(task.claimedIndex) &&
    task.claimedIndex >= 0 &&
    task.claimedIndex < task.options.length;
  if (!wellPosed) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  const correctIndex = reachingProgramIndices(task)[0]!;
  const correct = task.claimedIndex === correctIndex;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
