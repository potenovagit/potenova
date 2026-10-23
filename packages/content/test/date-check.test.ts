import { describe, it, expect } from 'vitest';
import {
  checkDateOffsetSelectTask,
  addDays,
  daysInMonth,
  isLeapYear,
  type DateOffsetSelectTask,
} from '@potenova/content';

describe('deterministic date-model oracle (G1 E2.3; CONT-001/003, NFR-07)', () => {
  it('knows month lengths and leap years', () => {
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(2028)).toBe(true);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
  });

  it('adds days with month rollover (and back)', () => {
    expect(addDays(2026, 3, 5, 3)).toEqual({ month: 3, day: 8 });
    expect(addDays(2026, 3, 30, 2)).toEqual({ month: 4, day: 1 }); // March has 31
    expect(addDays(2026, 2, 27, 3)).toEqual({ month: 3, day: 2 }); // Feb has 28
    expect(addDays(2026, 3, 1, -1)).toEqual({ month: 2, day: 28 }); // back over a boundary
  });

  it('passes when the learner picks the computed date', () => {
    const task: DateOffsetSelectTask = {
      kind: 'date_offset_select',
      year: 2026,
      month: 3,
      day: 30,
      offset: 2,
      options: [
        { month: 4, day: 1 },
        { month: 3, day: 31 },
        { month: 4, day: 2 },
      ],
      claimedIndex: 0,
    };
    expect(checkDateOffsetSelectTask(task)).toEqual({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
  });

  it('AT-20: the month-overflow error (March 32) is graded wrong', () => {
    const task: DateOffsetSelectTask = {
      kind: 'date_offset_select',
      year: 2026,
      month: 3,
      day: 30,
      offset: 2,
      options: [
        { month: 4, day: 1 },
        { month: 3, day: 31 },
        { month: 4, day: 2 },
      ],
      claimedIndex: 1, // March 31, as if the month kept going
    };
    const r = checkDateOffsetSelectTask(task);
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed on an invalid option date or a no-match set', () => {
    const invalid: DateOffsetSelectTask = {
      kind: 'date_offset_select',
      year: 2026,
      month: 2,
      day: 27,
      offset: 3,
      options: [
        { month: 2, day: 30 }, // Feb 30 — not a real date
        { month: 3, day: 2 },
      ],
      claimedIndex: 1,
    };
    expect(checkDateOffsetSelectTask(invalid)).toEqual({
      correct: false,
      ran: false,
      reason: 'MALFORMED_TASK',
    });
  });
});
