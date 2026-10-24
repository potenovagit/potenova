import { describe, it, expect } from 'vitest';
import {
  checkDecimalThousandthCompareTask,
  thousandthsRelation,
  formatThousandths,
  parseToThousandths,
  roundThousandthsToHundredth,
  checkDecimalRoundHundredthTask,
} from '@potenova/content';

describe('deterministic decimal-thousandths oracles (G6 exp 3/4; CONT-001/003, NFR-07)', () => {
  it('formats and parses thousandths exactly', () => {
    expect(formatThousandths(2475)).toBe('2.475');
    expect(formatThousandths(2500)).toBe('2.500');
    expect(formatThousandths(8)).toBe('0.008');
    expect(parseToThousandths('2.5')).toBe(2500);
    expect(parseToThousandths('2.475')).toBe(2475);
    expect(parseToThousandths('3')).toBe(3000);
    expect(parseToThousandths('2.4755')).toBeNull(); // more than 3 places
  });

  it('compares thousandths place-by-place (2.475 < 2.500 — the longer-looks-bigger trap)', () => {
    expect(thousandthsRelation(2475, 2500)).toBe('lt');
    expect(
      checkDecimalThousandthCompareTask({
        kind: 'decimal_thousandth_compare',
        leftThousandths: 2475,
        rightThousandths: 2500,
        claimedRelation: 'gt',
      }),
    ).toMatchObject({ correct: false, ran: true, reason: 'ANSWER_KEY_WRONG' });
  });

  it('rounds to the nearest hundredth, half up, carrying when needed', () => {
    expect(roundThousandthsToHundredth(2475)).toBe(2480); // 2.475 → 2.48
    expect(roundThousandthsToHundredth(2473)).toBe(2470); // 2.473 → 2.47
    expect(roundThousandthsToHundredth(2995)).toBe(3000); // 2.995 → 3.00
    expect(
      checkDecimalRoundHundredthTask({
        kind: 'decimal_round_hundredth',
        thousandths: 2475,
        claimedThousandths: 2470, // truncation
      }).reason,
    ).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed on out-of-range thousandths', () => {
    expect(
      checkDecimalThousandthCompareTask({
        kind: 'decimal_thousandth_compare',
        leftThousandths: 1000000,
        rightThousandths: 5,
        claimedRelation: 'gt',
      }).ran,
    ).toBe(false);
  });
});
