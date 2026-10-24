import { describe, it, expect } from 'vitest';
import {
  checkDecimalMulDivTask,
  decimalMulDivTenThousandths,
  formatTenThousandths,
  parseToTenThousandths,
} from '@potenova/content';

const base = { kind: 'decimal_muldiv' } as const;

describe('deterministic float-free decimal multiply/divide oracle (G7 B2.9; CONT-001/003, NFR-07)', () => {
  it('formats and parses ten-thousandths exactly', () => {
    expect(formatTenThousandths(2000)).toBe('0.2000');
    expect(formatTenThousandths(30000)).toBe('3.0000');
    expect(parseToTenThousandths('0.2')).toBe(2000);
    expect(parseToTenThousandths('3')).toBe(30000);
    expect(parseToTenThousandths('0.36')).toBe(3600);
    expect(parseToTenThousandths('0.12345')).toBeNull(); // more than 4 dp
  });

  it('multiplies exactly with no float error (0.5 × 0.4 = 0.20, not 0.2000000001)', () => {
    expect(decimalMulDivTenThousandths('×', 50, 40)).toBe(2000);
    expect(
      checkDecimalMulDivTask({
        ...base,
        op: '×',
        leftHundredths: 50,
        rightHundredths: 40,
        claimedTenThousandths: 2000,
      }),
    ).toMatchObject({ correct: true, ran: true, reason: 'ANSWER_KEY_CORRECT' });
  });

  it('divides when the quotient terminates (0.6 ÷ 0.2 = 3)', () => {
    expect(decimalMulDivTenThousandths('÷', 60, 20)).toBe(30000);
    expect(
      checkDecimalMulDivTask({
        ...base,
        op: '÷',
        leftHundredths: 60,
        rightHundredths: 20,
        claimedTenThousandths: 30000,
      }),
    ).toMatchObject({ correct: true, ran: true });
  });

  it('grades a wrong product wrong (no model)', () => {
    expect(
      checkDecimalMulDivTask({
        ...base,
        op: '×',
        leftHundredths: 50,
        rightHundredths: 40,
        claimedTenThousandths: 20000,
      }),
    ).toMatchObject({ correct: false, ran: true, reason: 'ANSWER_KEY_WRONG' });
  });

  it('fails closed on divide-by-zero and a non-terminating quotient', () => {
    expect(decimalMulDivTenThousandths('÷', 50, 0)).toBeNull();
    expect(decimalMulDivTenThousandths('÷', 100, 30)).toBeNull(); // 1 ÷ 0.3 = 3.333…
    expect(
      checkDecimalMulDivTask({
        ...base,
        op: '÷',
        leftHundredths: 100,
        rightHundredths: 30,
        claimedTenThousandths: 33333,
      }).ran,
    ).toBe(false);
  });

  it('fails closed on out-of-range operands and a non-integer claim', () => {
    expect(
      checkDecimalMulDivTask({
        ...base,
        op: '×',
        leftHundredths: 10001,
        rightHundredths: 40,
        claimedTenThousandths: 2000,
      }).ran,
    ).toBe(false);
    expect(
      checkDecimalMulDivTask({
        ...base,
        op: '×',
        leftHundredths: 50,
        rightHundredths: 40,
        claimedTenThousandths: 20.5,
      }).ran,
    ).toBe(false);
  });
});
