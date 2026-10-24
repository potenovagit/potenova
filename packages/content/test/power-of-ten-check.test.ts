import { describe, it, expect } from 'vitest';
import { checkPowerOfTenScaleTask, powerOfTenScaleThousandths } from '@potenova/content';

const base = { kind: 'power_of_ten_scale' } as const;

describe('deterministic float-free power-of-ten scaling oracle (G8 B2.3; CONT-001/003, NFR-07)', () => {
  it('multiplies by a power of ten exactly (3.5 × 100 = 350)', () => {
    expect(powerOfTenScaleThousandths('×', 3500, 2)).toBe(350000); // 3.5 → 350
    expect(powerOfTenScaleThousandths('×', 42, 3)).toBe(42000); // 0.042 → 42
    expect(
      checkPowerOfTenScaleTask({
        ...base,
        op: '×',
        valueThousandths: 3500,
        exponent: 2,
        claimedThousandths: 350000,
      }),
    ).toMatchObject({ correct: true, ran: true, reason: 'ANSWER_KEY_CORRECT' });
  });

  it('divides by a power of ten when it stays within thousandths (350 ÷ 100 = 3.5)', () => {
    expect(powerOfTenScaleThousandths('÷', 350000, 2)).toBe(3500);
    expect(
      checkPowerOfTenScaleTask({
        ...base,
        op: '÷',
        valueThousandths: 350000,
        exponent: 2,
        claimedThousandths: 3500,
      }),
    ).toMatchObject({ correct: true, ran: true });
  });

  it('grades the "moved the point the wrong way" error wrong (3.5 × 100 ≠ 0.035)', () => {
    expect(
      checkPowerOfTenScaleTask({
        ...base,
        op: '×',
        valueThousandths: 3500,
        exponent: 2,
        claimedThousandths: 35,
      }),
    ).toMatchObject({ correct: false, ran: true, reason: 'ANSWER_KEY_WRONG' });
  });

  it('fails closed when division would go finer than thousandths (0.5 ÷ 1000)', () => {
    expect(powerOfTenScaleThousandths('÷', 500, 4)).toBeNull(); // 0.5 ÷ 10000 = 0.00005
    expect(
      checkPowerOfTenScaleTask({
        ...base,
        op: '÷',
        valueThousandths: 500,
        exponent: 4,
        claimedThousandths: 0,
      }).ran,
    ).toBe(false);
  });

  it('fails closed on out-of-range operand/exponent and a non-integer claim', () => {
    expect(
      checkPowerOfTenScaleTask({
        ...base,
        op: '×',
        valueThousandths: 1000000,
        exponent: 2,
        claimedThousandths: 1,
      }).ran,
    ).toBe(false);
    expect(
      checkPowerOfTenScaleTask({
        ...base,
        op: '×',
        valueThousandths: 3500,
        exponent: 5,
        claimedThousandths: 1,
      }).ran,
    ).toBe(false);
  });
});
