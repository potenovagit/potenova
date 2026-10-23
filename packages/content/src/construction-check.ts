import type { MathCheckReason } from './math-check';

/**
 * Deterministic construction oracle (Ontario Grade 1 B1.1/B1.2: represent and
 * compose/decompose whole numbers flexibly with materials). The CONSTRUCTION
 * interaction lets the learner BUILD a target number from tens and ones — and,
 * unlike the fixed compose task, ANY valid decomposition is correct (2 tens 4
 * ones, 1 ten 14 ones, 0 tens 24 ones all make 24). The oracle checks the built
 * value equals the target; there is no single key, so correctness is the
 * checkable goal, not a model's judgement.
 *
 * Fail-closed: the target is a non-negative whole number within the Grade 1
 * bound (<= 50), and the built counts are non-negative whole numbers.
 */

export interface BuildNumberTask {
  readonly kind: 'build_number';
  readonly target: number;
  /** The learner's build. */
  readonly tens: number;
  readonly ones: number;
}

export interface ConstructionCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

const isNonNegInt = (n: number): boolean => Number.isInteger(n) && n >= 0;

/** The value a (tens, ones) build represents. */
export function builtValue(tens: number, ones: number): number {
  return tens * 10 + ones;
}

export function checkBuildNumberTask(task: BuildNumberTask): ConstructionCheckResult {
  if (task.kind !== 'build_number') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (
    !isNonNegInt(task.target) ||
    task.target > 50 ||
    !isNonNegInt(task.tens) ||
    !isNonNegInt(task.ones)
  ) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = builtValue(task.tens, task.ones) === task.target;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
