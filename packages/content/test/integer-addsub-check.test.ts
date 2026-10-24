import { describe, it, expect } from 'vitest';
import { checkIntegerAddSubTask, integerAddSubResult } from '@potenova/content';

const base = { kind: 'integer_addsub_signed' } as const;

describe('deterministic signed-integer add/subtract oracle (G7 B2.4; CONT-001/003, NFR-07)', () => {
  it('adds and subtracts across zero, including negative results', () => {
    expect(integerAddSubResult(-5, 3, '+')).toBe(-2);
    expect(integerAddSubResult(-5, -3, '-')).toBe(-2); // -5 - (-3) = -2
    expect(integerAddSubResult(4, 9, '-')).toBe(-5);
    expect(
      checkIntegerAddSubTask({ ...base, left: -5, right: 3, op: '+', claimedResult: -2 }),
    ).toMatchObject({ correct: true, ran: true, reason: 'ANSWER_KEY_CORRECT' });
  });

  it('grades the "subtracting a negative makes it smaller" error wrong (-5 - (-3) ≠ -8)', () => {
    expect(
      checkIntegerAddSubTask({ ...base, left: -5, right: -3, op: '-', claimedResult: -8 }),
    ).toMatchObject({ correct: false, ran: true, reason: 'ANSWER_KEY_WRONG' });
  });

  it('fails closed on out-of-range operands and a non-integer claim', () => {
    expect(
      checkIntegerAddSubTask({ ...base, left: 101, right: 3, op: '+', claimedResult: 104 }).ran,
    ).toBe(false);
    expect(
      checkIntegerAddSubTask({ ...base, left: -5, right: 3, op: '+', claimedResult: -2.5 }).ran,
    ).toBe(false);
  });
});
