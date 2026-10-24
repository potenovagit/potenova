import type { MathCheckReason } from './math-check';

/**
 * Deterministic parallelogram/triangle area oracles (Ontario Grade 5 E / exp 43:
 * develop and apply the area formulas for a parallelogram and a triangle).
 * Closed and rule-decidable: computed by exact integer arithmetic and graded
 * without a model.
 *
 * Two task kinds:
 *   - `parallelogram_area`  area = base × height
 *   - `triangle_area`       area = base × height ÷ 2
 *
 * To keep the answer a whole number (float-free), a triangle item is only
 * well-posed when base × height is EVEN; an odd product is MALFORMED and never
 * delivered. Fail-closed on range: base and height are whole numbers in
 * [1, 100]; the claimed area is an integer. Anything else is MALFORMED.
 */

const isSide = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= 100;

export interface ParallelogramAreaTask {
  readonly kind: 'parallelogram_area';
  readonly base: number;
  readonly height: number;
  readonly claimedArea: number;
}

export interface TriangleAreaTask {
  readonly kind: 'triangle_area';
  readonly base: number;
  readonly height: number;
  readonly claimedArea: number;
}

export interface PolygonAreaCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

export function parallelogramArea(base: number, height: number): number {
  return base * height;
}

export function checkParallelogramAreaTask(task: ParallelogramAreaTask): PolygonAreaCheckResult {
  if (task.kind !== 'parallelogram_area') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (!isSide(task.base) || !isSide(task.height) || !Number.isInteger(task.claimedArea)) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = parallelogramArea(task.base, task.height) === task.claimedArea;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}

export function checkTriangleAreaTask(task: TriangleAreaTask): PolygonAreaCheckResult {
  if (task.kind !== 'triangle_area') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  const product = task.base * task.height;
  if (
    !isSide(task.base) ||
    !isSide(task.height) ||
    product % 2 !== 0 || // keep the area a whole number
    !Number.isInteger(task.claimedArea)
  ) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = product / 2 === task.claimedArea;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
