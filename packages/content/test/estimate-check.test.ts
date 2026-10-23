import { describe, it, expect } from 'vitest';
import { checkEstimateTask, type EstimateTask } from '@potenova/content';

const est = (actual: number, low: number, high: number, claimed: number): EstimateTask => ({
  kind: 'estimate_within_band',
  actual,
  low,
  high,
  claimed,
});

describe('deterministic estimation oracle (G1 B1.4; CONT-001/003, NFR-07)', () => {
  it('accepts any estimate inside the reviewed band', () => {
    expect(checkEstimateTask(est(24, 20, 28, 22)).correct).toBe(true);
    expect(checkEstimateTask(est(24, 20, 28, 20)).correct).toBe(true); // inclusive low
    expect(checkEstimateTask(est(24, 20, 28, 28)).correct).toBe(true); // inclusive high
  });

  it('AT-20: an estimate outside the band is graded wrong', () => {
    const r = checkEstimateTask(est(24, 20, 28, 35));
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed when the reviewed band does not bracket the true count', () => {
    // A band that excludes the real answer is an ill-posed item.
    expect(checkEstimateTask(est(24, 10, 20, 15))).toEqual({
      correct: false,
      ran: false,
      reason: 'MALFORMED_TASK',
    });
  });

  it('fails closed on an inverted band or negative bounds', () => {
    expect(checkEstimateTask(est(24, 28, 20, 24)).ran).toBe(false); // low > high
    expect(checkEstimateTask(est(24, -1, 28, 24)).ran).toBe(false);
  });
});
