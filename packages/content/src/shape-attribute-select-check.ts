import type { MathCheckReason } from './math-check';

/**
 * Deterministic shape-attribute selection oracle (Ontario Grade 1 E1.1–E1.3:
 * identify and sort two-dimensional shapes by an attribute). A SELECTION task:
 * "which shape has N sides?" — the learner picks the shape; the oracle counts
 * sides and recomputes the correct choice.
 *
 * Same content-gate guarantee as the other selections: each option carries its
 * own side count, the oracle derives which option matches the target attribute,
 * and only a well-posed item — exactly one option matches — is delivered. The
 * attribute compared here is the side count (the canonical G1 sorting attribute);
 * a circle is encoded as 0 sides.
 *
 * Fail-closed: a non-negative whole-number target and option side counts, at
 * least two options, and exactly one option at the target count.
 */

export interface ShapeOption {
  readonly name: string;
  readonly sides: number;
}

export interface ShapeAttributeSelectTask {
  readonly kind: 'shape_attribute_select';
  readonly targetSides: number;
  readonly options: readonly ShapeOption[];
  /** The chosen shape as a 0-based index (an answer key, or a learner's pick). */
  readonly claimedIndex: number;
}

export interface ShapeCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;

/** The indices of the options with the target side count (the oracle's own key). */
export function matchingShapeIndices(
  targetSides: number,
  options: readonly ShapeOption[],
): number[] {
  return options.flatMap((o, i) => (o.sides === targetSides ? [i] : []));
}

export function checkShapeAttributeSelectTask(task: ShapeAttributeSelectTask): ShapeCheckResult {
  if (task.kind !== 'shape_attribute_select') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  const wellPosed =
    isNonNegInt(task.targetSides) &&
    task.options.length >= 2 &&
    task.options.every((o) => isNonNegInt(o.sides)) &&
    matchingShapeIndices(task.targetSides, task.options).length === 1 &&
    Number.isInteger(task.claimedIndex) &&
    task.claimedIndex >= 0 &&
    task.claimedIndex < task.options.length;
  if (!wellPosed) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  const correctIndex = matchingShapeIndices(task.targetSides, task.options)[0]!;
  const correct = task.claimedIndex === correctIndex;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
