import type { MathCheckReason } from './math-check';

/**
 * Deterministic rectangle-area oracles (Ontario Grade 4 E / exp 41, 42: measure
 * the area of a rectangle as length × width, and find an unknown side when the
 * area and the other side are given). Closed and rule-decidable: computed by
 * exact integer arithmetic and graded without a model.
 *
 * Two task kinds:
 *   - `rectangle_area`         area = length × width
 *   - `rectangle_missing_side` the unknown side = area ÷ known side (exact)
 *
 * Fail-closed on range: lengths/sides are whole numbers in [1, 100], an area is
 * a whole number in [1, 10000]; for a missing-side item the known side must
 * divide the area evenly. Anything else is MALFORMED.
 */

const isSide = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= 100;
const isArea = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= 10000;

export interface RectangleAreaTask {
  readonly kind: 'rectangle_area';
  readonly length: number;
  readonly width: number;
  readonly claimedArea: number;
}

export interface RectangleMissingSideTask {
  readonly kind: 'rectangle_missing_side';
  readonly area: number;
  readonly knownSide: number;
  readonly claimedSide: number;
}

export interface RectangleCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

export function rectangleArea(length: number, width: number): number {
  return length * width;
}

export function checkRectangleAreaTask(task: RectangleAreaTask): RectangleCheckResult {
  if (task.kind !== 'rectangle_area') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (!isSide(task.length) || !isSide(task.width) || !Number.isInteger(task.claimedArea)) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = rectangleArea(task.length, task.width) === task.claimedArea;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}

export function checkRectangleMissingSideTask(
  task: RectangleMissingSideTask,
): RectangleCheckResult {
  if (task.kind !== 'rectangle_missing_side') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  const wellPosed =
    isArea(task.area) &&
    isSide(task.knownSide) &&
    task.area % task.knownSide === 0 &&
    task.area / task.knownSide <= 100 &&
    Number.isInteger(task.claimedSide);
  if (!wellPosed) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  const correct = task.area / task.knownSide === task.claimedSide;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
