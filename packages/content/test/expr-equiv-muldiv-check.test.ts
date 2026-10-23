import { describe, it, expect } from 'vitest';
import {
  checkExprEquivalenceMulDivTask,
  evalExprMulDiv,
  type ExprEquivalenceMulDivTask,
} from '@potenova/content';

const t = (
  left: ExprEquivalenceMulDivTask['left'],
  right: ExprEquivalenceMulDivTask['right'],
  claimedEquivalent: boolean,
): ExprEquivalenceMulDivTask => ({
  kind: 'expr_equivalence_muldiv',
  left,
  right,
  claimedEquivalent,
});

describe('deterministic ×/÷ expression-equivalence oracle (G3 B2.2; CONT-001/003, NFR-07)', () => {
  it('evaluates all four operations exactly', () => {
    expect(evalExprMulDiv({ a: 4, op: '*', b: 3 })).toBe(12);
    expect(evalExprMulDiv({ a: 24, op: '/', b: 2 })).toBe(12);
    expect(evalExprMulDiv({ a: 7, op: '+', b: 2 })).toBe(9);
    expect(evalExprMulDiv({ a: 9, op: '-', b: 2 })).toBe(7);
  });

  it('passes a true cross-operation equivalence (4 × 3 == 24 ÷ 2)', () => {
    expect(
      checkExprEquivalenceMulDivTask(t({ a: 4, op: '*', b: 3 }, { a: 24, op: '/', b: 2 }, true)),
    ).toEqual({ correct: true, ran: true, reason: 'ANSWER_KEY_CORRECT' });
  });

  it('grades a wrong verdict wrong (5 × 2 vs 40 ÷ 5 are not equal)', () => {
    const r = checkExprEquivalenceMulDivTask(
      t({ a: 5, op: '*', b: 2 }, { a: 40, op: '/', b: 5 }, true),
    );
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed on divide-by-zero, a non-exact quotient, or a negative side', () => {
    expect(evalExprMulDiv({ a: 5, op: '/', b: 0 })).toBeNull();
    expect(evalExprMulDiv({ a: 7, op: '/', b: 2 })).toBeNull();
    expect(evalExprMulDiv({ a: 2, op: '-', b: 5 })).toBeNull();
    expect(
      checkExprEquivalenceMulDivTask(t({ a: 7, op: '/', b: 2 }, { a: 4, op: '*', b: 1 }, false))
        .reason,
    ).toBe('MALFORMED_TASK');
  });
});
