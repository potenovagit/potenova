import { describe, it, expect } from 'vitest';
import {
  checkRepresentationSelectTask,
  representationValue,
  matchingRepresentationIndices,
  type NumberRepresentationSelectTask,
} from '@potenova/content';

const task = (
  target: number,
  options: { tens: number; ones: number }[],
  claimedIndex: number,
): NumberRepresentationSelectTask => ({
  kind: 'number_representation_select',
  target,
  options,
  claimedIndex,
});

describe('deterministic selection oracle — represent numbers to 50 (G1 B1.1; CONT-001/003)', () => {
  it('recomputes each option value and finds the matching option', () => {
    expect(representationValue({ tens: 2, ones: 3 })).toBe(23);
    const opts = [
      { tens: 2, ones: 3 },
      { tens: 3, ones: 2 },
      { tens: 1, ones: 3 },
    ];
    expect(matchingRepresentationIndices(23, opts)).toEqual([0]);
  });

  it('passes when the learner picks the option that shows the target', () => {
    const good = task(
      23,
      [
        { tens: 2, ones: 3 },
        { tens: 3, ones: 2 },
        { tens: 1, ones: 3 },
      ],
      0,
    );
    expect(checkRepresentationSelectTask(good)).toEqual({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
  });

  it('AT-20: the swapped-place distractor (3 tens 2 ones for 23) is graded wrong', () => {
    const bad = task(
      23,
      [
        { tens: 2, ones: 3 },
        { tens: 3, ones: 2 },
        { tens: 1, ones: 3 },
      ],
      1,
    );
    const r = checkRepresentationSelectTask(bad);
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed on an ill-posed item: NO option matches the target', () => {
    const none = task(
      23,
      [
        { tens: 3, ones: 2 },
        { tens: 1, ones: 3 },
      ],
      0,
    );
    expect(checkRepresentationSelectTask(none)).toEqual({
      correct: false,
      ran: false,
      reason: 'MALFORMED_TASK',
    });
  });

  it('fails closed on an ill-posed item: MORE THAN ONE option matches', () => {
    const two = task(
      20,
      [
        { tens: 2, ones: 0 },
        { tens: 2, ones: 0 },
        { tens: 1, ones: 0 },
      ],
      0,
    );
    expect(checkRepresentationSelectTask(two).ran).toBe(false);
  });

  it('fails closed above the Grade 1 bound of 50, or on a bad ones digit', () => {
    expect(
      checkRepresentationSelectTask(
        task(
          60,
          [
            { tens: 6, ones: 0 },
            { tens: 5, ones: 0 },
          ],
          0,
        ),
      ).ran,
    ).toBe(false);
    expect(
      checkRepresentationSelectTask(
        task(
          23,
          [
            { tens: 2, ones: 13 },
            { tens: 2, ones: 3 },
          ],
          1,
        ),
      ).ran,
    ).toBe(false);
  });
});
