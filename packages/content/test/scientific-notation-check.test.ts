import { describe, it, expect } from 'vitest';
import { checkScientificNotationTask, scientificToStandard } from '@potenova/content';

const base = { kind: 'scientific_notation' } as const;

describe('deterministic scientific-notation oracle (G8 B1.1; CONT-001/003, NFR-07)', () => {
  it('expands a × 10^b to standard form exactly', () => {
    expect(scientificToStandard(320, 3)).toBe(3200); // 3.20 × 10^3
    expect(scientificToStandard(100, 6)).toBe(1000000); // 1.00 × 10^6
    expect(scientificToStandard(725, 2)).toBe(725); // 7.25 × 10^2
    expect(
      checkScientificNotationTask({
        ...base,
        coefficientHundredths: 320,
        exponent: 3,
        claimedValue: 3200,
      }),
    ).toMatchObject({ correct: true, ran: true, reason: 'ANSWER_KEY_CORRECT' });
  });

  it('grades the "wrong number of zeros" error wrong (3.2 × 10^3 ≠ 320)', () => {
    expect(
      checkScientificNotationTask({
        ...base,
        coefficientHundredths: 320,
        exponent: 3,
        claimedValue: 320,
      }),
    ).toMatchObject({ correct: false, ran: true, reason: 'ANSWER_KEY_WRONG' });
  });

  it('fails closed when the standard form is not a whole number (3.25 × 10^0)', () => {
    expect(scientificToStandard(325, 0)).toBeNull(); // 3.25
    expect(
      checkScientificNotationTask({
        ...base,
        coefficientHundredths: 325,
        exponent: 0,
        claimedValue: 3,
      }).ran,
    ).toBe(false);
  });

  it('fails closed on an improper coefficient (≥ 10) and out-of-range exponent', () => {
    expect(scientificToStandard(1050, 2)).toBeNull(); // 10.5 is not 1 ≤ a < 10
    expect(
      checkScientificNotationTask({
        ...base,
        coefficientHundredths: 1050,
        exponent: 2,
        claimedValue: 1050,
      }).ran,
    ).toBe(false);
    expect(
      checkScientificNotationTask({
        ...base,
        coefficientHundredths: 320,
        exponent: 8,
        claimedValue: 1,
      }).ran,
    ).toBe(false);
  });
});
