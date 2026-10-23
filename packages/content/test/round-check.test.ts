import { describe, it, expect } from 'vitest';
import { checkRoundWholeTask, roundToPlace, type RoundWholeTask } from '@potenova/content';

const r = (value: number, place: 10 | 100 | 1000, claimedRounded: number): RoundWholeTask => ({
  kind: 'round_whole',
  value,
  place,
  claimedRounded,
});

describe('deterministic whole-number rounding oracle (G4 exp 2; CONT-001/003, NFR-07)', () => {
  it('rounds to the nearest place, half rounding up', () => {
    expect(roundToPlace(47, 10)).toBe(50);
    expect(roundToPlace(432, 100)).toBe(400);
    expect(roundToPlace(2750, 1000)).toBe(3000); // half rounds up
    expect(roundToPlace(1489, 100)).toBe(1500);
  });

  it('passes a correct rounding', () => {
    expect(checkRoundWholeTask(r(1489, 100, 1500))).toEqual({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
  });

  it('detects the truncate-instead-of-round error (1489 → 1400)', () => {
    const res = checkRoundWholeTask(r(1489, 100, 1400));
    expect(res.ran).toBe(true);
    expect(res.correct).toBe(false);
    expect(res.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed on a bad place, a negative value, or one over 100000', () => {
    expect(
      checkRoundWholeTask({ kind: 'round_whole', value: 50, place: 5 as 10, claimedRounded: 50 })
        .ran,
    ).toBe(false);
    expect(checkRoundWholeTask(r(-10, 10, -10)).reason).toBe('MALFORMED_TASK');
    expect(checkRoundWholeTask(r(100001, 1000, 100000)).ran).toBe(false);
  });
});
