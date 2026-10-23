import { describe, it, expect } from 'vitest';
import {
  checkDecimalCompareTask,
  decimalRelation,
  roundTenthsToWhole,
  checkDecimalRoundTask,
  checkFractionDecimalEquivTask,
  formatTenths,
} from '@potenova/content';

describe('deterministic decimal-tenths oracles (G4 exp 6/7/8; CONT-001/003, NFR-07)', () => {
  it('formats tenths as a decimal string', () => {
    expect(formatTenths(23)).toBe('2.3');
    expect(formatTenths(8)).toBe('0.8');
    expect(formatTenths(60)).toBe('6.0');
  });

  it('compares tenths exactly (0.8 < 1.0 — the point trap)', () => {
    expect(decimalRelation(8, 10)).toBe('lt');
    expect(
      checkDecimalCompareTask({
        kind: 'decimal_tenth_compare',
        leftTenths: 8,
        rightTenths: 10,
        claimedRelation: 'gt', // the "8 > 1" error
      }),
    ).toMatchObject({ correct: false, ran: true, reason: 'ANSWER_KEY_WRONG' });
  });

  it('rounds a decimal to the nearest whole, half up', () => {
    expect(roundTenthsToWhole(24)).toBe(2);
    expect(roundTenthsToWhole(27)).toBe(3);
    expect(roundTenthsToWhole(25)).toBe(3); // half rounds up
    expect(
      checkDecimalRoundTask({ kind: 'decimal_round_whole', tenths: 27, claimedWhole: 2 }).reason,
    ).toBe('ANSWER_KEY_WRONG'); // truncation
  });

  it('relates fractions to decimal tenths exactly (1/2 == 0.5; 1/4 ≠ 0.3)', () => {
    expect(
      checkFractionDecimalEquivTask({
        kind: 'fraction_decimal_equiv',
        numerator: 1,
        denominator: 2,
        tenths: 5,
        claimedEquivalent: true,
      }).correct,
    ).toBe(true);
    expect(
      checkFractionDecimalEquivTask({
        kind: 'fraction_decimal_equiv',
        numerator: 1,
        denominator: 4,
        tenths: 3,
        claimedEquivalent: true,
      }).correct,
    ).toBe(false);
  });

  it('fails closed on out-of-range tenths, a zero denominator, or a bad relation', () => {
    expect(
      checkDecimalCompareTask({
        kind: 'decimal_tenth_compare',
        leftTenths: 10000,
        rightTenths: 5,
        claimedRelation: 'gt',
      }).ran,
    ).toBe(false);
    expect(
      checkFractionDecimalEquivTask({
        kind: 'fraction_decimal_equiv',
        numerator: 1,
        denominator: 0,
        tenths: 5,
        claimedEquivalent: true,
      }).reason,
    ).toBe('MALFORMED_TASK');
    expect(
      checkDecimalRoundTask({ kind: 'decimal_round_whole', tenths: -5, claimedWhole: 0 }).ran,
    ).toBe(false);
  });
});
