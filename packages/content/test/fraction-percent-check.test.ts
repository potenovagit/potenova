import { describe, it, expect } from 'vitest';
import { checkFractionPercentEquivTask, type FractionPercentEquivTask } from '@potenova/content';

const t = (
  numerator: number,
  denominator: number,
  percent: number,
  claimedEquivalent: boolean,
): FractionPercentEquivTask => ({
  kind: 'fraction_percent_equiv',
  numerator,
  denominator,
  percent,
  claimedEquivalent,
});

describe('deterministic fraction↔percent equivalence oracle (G5 exp 6; CONT-001/003, NFR-07)', () => {
  it('confirms true equivalences (1/2 == 50%, 3/4 == 75%, 1/5 == 20%)', () => {
    expect(checkFractionPercentEquivTask(t(1, 2, 50, true)).correct).toBe(true);
    expect(checkFractionPercentEquivTask(t(3, 4, 75, true)).correct).toBe(true);
    expect(checkFractionPercentEquivTask(t(1, 5, 20, true)).correct).toBe(true);
  });

  it('detects the numerator-as-percent error (1/4 == 40% claimed true)', () => {
    const r = checkFractionPercentEquivTask(t(1, 4, 40, true));
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('accepts a correct "no" for a non-equivalence (1/4 == 40% → no)', () => {
    expect(checkFractionPercentEquivTask(t(1, 4, 40, false)).correct).toBe(true);
  });

  it('fails closed on a zero denominator or a percent outside [0,100]', () => {
    expect(checkFractionPercentEquivTask(t(1, 0, 50, true)).ran).toBe(false);
    expect(checkFractionPercentEquivTask(t(3, 2, 150, true)).reason).toBe('MALFORMED_TASK');
  });
});
