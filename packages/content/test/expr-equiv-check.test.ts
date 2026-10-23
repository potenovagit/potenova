import { describe, it, expect } from 'vitest';
import { checkExprEquivalenceTask, evalExpr, type ExprEquivalenceTask } from '@potenova/content';

describe('deterministic expression-equivalence oracle (G1 C2.2; CONT-001/003, NFR-07)', () => {
  it('evaluates simple whole-number expressions, fail-closed out of range', () => {
    expect(evalExpr({ a: 3, op: '+', b: 4 })).toBe(7);
    expect(evalExpr({ a: 9, op: '-', b: 2 })).toBe(7);
    expect(evalExpr({ a: 2, op: '-', b: 5 })).toBeNull(); // negative result
    expect(evalExpr({ a: 2.5, op: '+', b: 1 })).toBeNull(); // non-integer operand
  });

  it('passes a correct "equal" verdict', () => {
    const good: ExprEquivalenceTask = {
      kind: 'expr_equivalence',
      left: { a: 3, op: '+', b: 4 },
      right: { a: 9, op: '-', b: 2 },
      claimedEquivalent: true,
    };
    expect(checkExprEquivalenceTask(good)).toEqual({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
  });

  it('AT-20: the "= means write the answer" error (judging only one side) is detected', () => {
    // 5 + 2 (=7) vs 4 + 2 (=6) are NOT equal; claiming they are is wrong.
    const bad: ExprEquivalenceTask = {
      kind: 'expr_equivalence',
      left: { a: 5, op: '+', b: 2 },
      right: { a: 4, op: '+', b: 2 },
      claimedEquivalent: true,
    };
    const r = checkExprEquivalenceTask(bad);
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('grades a correct "not equal" verdict', () => {
    expect(
      checkExprEquivalenceTask({
        kind: 'expr_equivalence',
        left: { a: 8, op: '-', b: 3 },
        right: { a: 3, op: '+', b: 3 },
        claimedEquivalent: false,
      }).correct,
    ).toBe(true);
  });

  it('fails closed when a side is out of range', () => {
    expect(
      checkExprEquivalenceTask({
        kind: 'expr_equivalence',
        left: { a: 2, op: '-', b: 5 }, // negative → malformed
        right: { a: 1, op: '+', b: 1 },
        claimedEquivalent: false,
      }),
    ).toEqual({ correct: false, ran: false, reason: 'MALFORMED_TASK' });
  });
});
