import { describe, it, expect } from 'vitest';
import { checkIntegerMulDivTask, integerMulDivResult } from '@potenova/content';

const base = { kind: 'integer_muldiv_signed' } as const;

describe('deterministic signed-integer multiply/divide oracle (G8 B2.7; CONT-001/003, NFR-07)', () => {
  it('applies the sign rules exactly', () => {
    expect(integerMulDivResult(-6, 7, '×')).toBe(-42);
    expect(integerMulDivResult(-6, -7, '×')).toBe(42); // neg × neg = pos
    expect(integerMulDivResult(-48, 6, '÷')).toBe(-8);
    expect(integerMulDivResult(-48, -6, '÷')).toBe(8);
    expect(
      checkIntegerMulDivTask({ ...base, left: -6, right: -7, op: '×', claimedResult: 42 }),
    ).toMatchObject({ correct: true, ran: true, reason: 'ANSWER_KEY_CORRECT' });
  });

  it('grades the "negative times negative is negative" error wrong', () => {
    expect(
      checkIntegerMulDivTask({ ...base, left: -6, right: -7, op: '×', claimedResult: -42 }),
    ).toMatchObject({ correct: false, ran: true, reason: 'ANSWER_KEY_WRONG' });
  });

  it('fails closed on divide-by-zero and a non-integer quotient', () => {
    expect(integerMulDivResult(5, 0, '÷')).toBeNull();
    expect(integerMulDivResult(7, 2, '÷')).toBeNull(); // 3.5
    expect(
      checkIntegerMulDivTask({ ...base, left: 7, right: 2, op: '÷', claimedResult: 3 }).ran,
    ).toBe(false);
  });

  it('fails closed on out-of-range operands and a non-integer claim', () => {
    expect(
      checkIntegerMulDivTask({ ...base, left: 200, right: 2, op: '×', claimedResult: 400 }).ran,
    ).toBe(false);
    expect(
      checkIntegerMulDivTask({ ...base, left: -6, right: -7, op: '×', claimedResult: 42.5 }).ran,
    ).toBe(false);
  });
});
