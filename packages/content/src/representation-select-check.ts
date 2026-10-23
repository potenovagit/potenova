import type { MathCheckReason } from './math-check';

/**
 * Deterministic selection ("which one shows …") oracle — the first richer,
 * non-type-the-answer interaction (Ontario Grade 1 B1.1: read and represent
 * whole numbers to 50). The learner is shown a target number and a few base-ten
 * representations and picks the one that shows it.
 *
 * This keeps the content gate honest for a multiple-choice item: the correct
 * option is NOT an author-asserted flag — the oracle RECOMPUTES each option's
 * value (tens×10 + ones) and derives the correct choice itself, exactly one of
 * which may match the target. An item where zero or more than one option matches
 * is MALFORMED (ill-posed) and never delivered, so a child can never be graded
 * against an answer key the oracle did not independently verify.
 *
 * Fail-closed on range: the target is a whole number in [0, 50] (the Grade 1
 * bound), every option is a well-formed (tens, ones) pair with ones in [0, 9],
 * there are at least two options, and exactly one option equals the target.
 */

export interface RepresentationOption {
  readonly tens: number;
  readonly ones: number;
}

export interface NumberRepresentationSelectTask {
  readonly kind: 'number_representation_select';
  readonly target: number;
  readonly options: readonly RepresentationOption[];
  /** The chosen option as a 0-based index (an answer key, or a learner's pick). */
  readonly claimedIndex: number;
}

export interface SelectionCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;

/** The whole-number value a base-ten representation stands for. */
export function representationValue(opt: RepresentationOption): number {
  return opt.tens * 10 + opt.ones;
}

const optionWellFormed = (opt: RepresentationOption): boolean =>
  isNonNegInt(opt.tens) && isNonNegInt(opt.ones) && opt.ones <= 9;

/** The indices of the options that equal the target (the oracle's own answer key). */
export function matchingRepresentationIndices(
  target: number,
  options: readonly RepresentationOption[],
): number[] {
  return options.flatMap((o, i) => (representationValue(o) === target ? [i] : []));
}

export function checkRepresentationSelectTask(
  task: NumberRepresentationSelectTask,
): SelectionCheckResult {
  if (task.kind !== 'number_representation_select') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  const wellPosed =
    isNonNegInt(task.target) &&
    task.target <= 50 &&
    task.options.length >= 2 &&
    task.options.every(optionWellFormed) &&
    matchingRepresentationIndices(task.target, task.options).length === 1 &&
    Number.isInteger(task.claimedIndex) &&
    task.claimedIndex >= 0 &&
    task.claimedIndex < task.options.length;
  if (!wellPosed) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  const correctIndex = matchingRepresentationIndices(task.target, task.options)[0]!;
  const correct = task.claimedIndex === correctIndex;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
