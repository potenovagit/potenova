import type { MathCheckReason } from './math-check';

/**
 * Deterministic positional-language selection oracle (Ontario Grade 1 E1.4:
 * describe and use the relative position of objects — above/below/left/right).
 * A SELECTION task: the learner is shown a target relation in words ("which
 * picture shows the star ABOVE the box?") and picks the scene that satisfies it.
 *
 * Like the number-representation selection, the correct option is not asserted:
 * each scene carries the two objects' grid positions, and the oracle RECOMPUTES
 * which scene satisfies the target relation. Only a well-posed item — exactly
 * one scene satisfies — passes the content gate, so a child is never graded
 * against an unverified key.
 *
 * Grid convention: smaller row = higher up, smaller column = further left
 * (screen coordinates). Coordinates are non-negative whole numbers.
 */

export const POSITION_RELATIONS = ['above', 'below', 'left_of', 'right_of'] as const;
export type PositionRelation = (typeof POSITION_RELATIONS)[number];

export interface GridPoint {
  readonly r: number;
  readonly c: number;
}

export interface PositionalScene {
  /** The object the question is about. */
  readonly subject: GridPoint;
  /** The object it is positioned relative to. */
  readonly reference: GridPoint;
}

export interface PositionalSelectTask {
  readonly kind: 'positional_select';
  readonly relation: PositionRelation;
  readonly options: readonly PositionalScene[];
  /** The chosen scene as a 0-based index (an answer key, or a learner's pick). */
  readonly claimedIndex: number;
}

export interface PositionalCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;
const pointOk = (p: GridPoint): boolean => isNonNegInt(p.r) && isNonNegInt(p.c);

/** Whether the subject sits in the given relation to the reference. */
export function relationHolds(relation: PositionRelation, scene: PositionalScene): boolean {
  const { subject: s, reference: ref } = scene;
  switch (relation) {
    case 'above':
      return s.r < ref.r;
    case 'below':
      return s.r > ref.r;
    case 'left_of':
      return s.c < ref.c;
    case 'right_of':
      return s.c > ref.c;
  }
}

/** The indices of the scenes that satisfy the relation (the oracle's own key). */
export function matchingPositionalIndices(
  relation: PositionRelation,
  options: readonly PositionalScene[],
): number[] {
  return options.flatMap((o, i) => (relationHolds(relation, o) ? [i] : []));
}

export function checkPositionalSelectTask(task: PositionalSelectTask): PositionalCheckResult {
  if (task.kind !== 'positional_select') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  const wellPosed =
    (POSITION_RELATIONS as readonly string[]).includes(task.relation) &&
    task.options.length >= 2 &&
    task.options.every((o) => pointOk(o.subject) && pointOk(o.reference)) &&
    matchingPositionalIndices(task.relation, task.options).length === 1 &&
    Number.isInteger(task.claimedIndex) &&
    task.claimedIndex >= 0 &&
    task.claimedIndex < task.options.length;
  if (!wellPosed) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  const correctIndex = matchingPositionalIndices(task.relation, task.options)[0]!;
  const correct = task.claimedIndex === correctIndex;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
