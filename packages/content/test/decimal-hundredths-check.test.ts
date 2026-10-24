import { describe, it, expect } from 'vitest';
import {
  checkDecimalHundredthCompareTask,
  hundredthsRelation,
  formatHundredths,
  parseToHundredths,
  roundHundredthsToTenth,
  checkDecimalRoundTenthTask,
} from '@potenova/content';

describe('deterministic decimal-hundredths oracles (G5 exp 4/5; CONT-001/003, NFR-07)', () => {
  it('formats and parses hundredths exactly', () => {
    expect(formatHundredths(247)).toBe('2.47');
    expect(formatHundredths(250)).toBe('2.50');
    expect(formatHundredths(8)).toBe('0.08');
    expect(parseToHundredths('2.5')).toBe(250);
    expect(parseToHundredths('2.47')).toBe(247);
    expect(parseToHundredths('3')).toBe(300);
    expect(parseToHundredths('2.470')).toBeNull(); // more than 2 places
    expect(parseToHundredths('x')).toBeNull();
  });

  it('compares hundredths place-by-place (2.47 < 2.50 — the longer-looks-bigger trap)', () => {
    expect(hundredthsRelation(247, 250)).toBe('lt');
    expect(
      checkDecimalHundredthCompareTask({
        kind: 'decimal_hundredth_compare',
        leftHundredths: 247,
        rightHundredths: 250,
        claimedRelation: 'gt',
      }),
    ).toMatchObject({ correct: false, ran: true, reason: 'ANSWER_KEY_WRONG' });
  });

  it('rounds to the nearest tenth, half up, carrying when needed', () => {
    expect(roundHundredthsToTenth(247)).toBe(250); // 2.47 → 2.5
    expect(roundHundredthsToTenth(243)).toBe(240); // 2.43 → 2.4
    expect(roundHundredthsToTenth(295)).toBe(300); // 2.95 → 3.0
    expect(
      checkDecimalRoundTenthTask({
        kind: 'decimal_round_tenth',
        hundredths: 247,
        claimedHundredths: 240, // truncation
      }).reason,
    ).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed on out-of-range hundredths', () => {
    expect(
      checkDecimalHundredthCompareTask({
        kind: 'decimal_hundredth_compare',
        leftHundredths: 100000,
        rightHundredths: 5,
        claimedRelation: 'gt',
      }).ran,
    ).toBe(false);
    expect(
      checkDecimalRoundTenthTask({
        kind: 'decimal_round_tenth',
        hundredths: -1,
        claimedHundredths: 0,
      }).ran,
    ).toBe(false);
  });
});
