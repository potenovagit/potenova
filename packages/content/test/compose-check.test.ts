import { describe, it, expect } from 'vitest';
import { checkComposeTask, composeValue, type PlaceValueComposeTask } from '@potenova/content';

describe('deterministic place-value composition oracle (G1 B1.2; CONT-001/003, NFR-07)', () => {
  it('composes a number from tens and ones', () => {
    expect(composeValue(3, 5)).toBe(35);
    expect(composeValue(4, 0)).toBe(40);
    expect(composeValue(0, 7)).toBe(7);
  });

  it('passes a correct composition', () => {
    const good: PlaceValueComposeTask = {
      kind: 'place_value_compose',
      tens: 3,
      ones: 5,
      claimedValue: 35,
    };
    expect(checkComposeTask(good)).toEqual({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
  });

  it('AT-20: the digit-concatenation error (1 ten 5 ones → 105) is detected', () => {
    const bad: PlaceValueComposeTask = {
      kind: 'place_value_compose',
      tens: 1,
      ones: 5,
      claimedValue: 105,
    };
    const r = checkComposeTask(bad);
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed above the Grade 1 bound of 50, or with a bad ones digit', () => {
    expect(
      checkComposeTask({ kind: 'place_value_compose', tens: 6, ones: 0, claimedValue: 60 }),
    ).toEqual({ correct: false, ran: false, reason: 'MALFORMED_TASK' });
    expect(
      checkComposeTask({ kind: 'place_value_compose', tens: 2, ones: 12, claimedValue: 32 }).ran,
    ).toBe(false);
  });

  it('fails closed on negative or non-integer parts', () => {
    expect(
      checkComposeTask({ kind: 'place_value_compose', tens: -1, ones: 2, claimedValue: -8 }).ran,
    ).toBe(false);
  });
});
