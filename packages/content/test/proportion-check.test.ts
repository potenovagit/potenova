import { describe, it, expect } from 'vitest';
import { checkProportionSolveTask, proportionSolve } from '@potenova/content';

const base = { kind: 'proportion_solve' } as const;

describe('deterministic proportion-solving oracle (G7 B2.10; CONT-001/003, NFR-07)', () => {
  it('solves a/b = c/x for x by cross-multiplication', () => {
    expect(proportionSolve(2, 3, 4)).toBe(6); // 2/3 = 4/x → x = 6
    expect(proportionSolve(3, 4, 9)).toBe(12); // 3/4 = 9/x → x = 12
    expect(proportionSolve(5, 2, 10)).toBe(4); // 5/2 = 10/x → x = 4
    expect(checkProportionSolveTask({ ...base, a: 2, b: 3, c: 4, claimedX: 6 })).toMatchObject({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
  });

  it('grades a wrong value wrong (no model)', () => {
    expect(checkProportionSolveTask({ ...base, a: 2, b: 3, c: 4, claimedX: 5 })).toMatchObject({
      correct: false,
      ran: true,
      reason: 'ANSWER_KEY_WRONG',
    });
  });

  it('fails closed when the missing term is not a whole number (2/5 = 3/x → 7.5)', () => {
    expect(proportionSolve(2, 5, 3)).toBeNull(); // 5·3 / 2 = 7.5
    expect(checkProportionSolveTask({ ...base, a: 2, b: 5, c: 3, claimedX: 7 }).ran).toBe(false);
  });

  it('fails closed on out-of-range terms and a non-positive claim', () => {
    expect(checkProportionSolveTask({ ...base, a: 0, b: 3, c: 4, claimedX: 6 }).ran).toBe(false);
    expect(checkProportionSolveTask({ ...base, a: 2, b: 3, c: 4, claimedX: 0 }).ran).toBe(false);
  });
});
