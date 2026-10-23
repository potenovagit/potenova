import { describe, it, expect } from 'vitest';
import { checkCalendarTask, dayAfter, type CalendarNextDayTask } from '@potenova/content';

describe('deterministic calendar-day oracle (G1 E2.3; CONT-001/003, NFR-07)', () => {
  it('computes the day with the week wrapping both ways', () => {
    expect(dayAfter('wednesday', 1)).toBe('thursday');
    expect(dayAfter('saturday', 1)).toBe('sunday'); // wrap forward
    expect(dayAfter('sunday', -1)).toBe('saturday'); // wrap back
    expect(dayAfter('notaday', 1)).toBeNull();
  });

  it('passes a correct next-day answer', () => {
    const good: CalendarNextDayTask = {
      kind: 'calendar_next_day',
      day: 'wednesday',
      offset: 1,
      claimedDay: 'thursday',
    };
    expect(checkCalendarTask(good)).toEqual({
      correct: true,
      ran: true,
      reason: 'ANSWER_KEY_CORRECT',
    });
  });

  it('AT-20: the no-wrap error after Saturday is detected', () => {
    const bad: CalendarNextDayTask = {
      kind: 'calendar_next_day',
      day: 'saturday',
      offset: 1,
      claimedDay: 'friday', // not the next day
    };
    const r = checkCalendarTask(bad);
    expect(r.ran).toBe(true);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('ANSWER_KEY_WRONG');
  });

  it('fails closed on an invalid day or an out-of-range offset', () => {
    expect(
      checkCalendarTask({
        kind: 'calendar_next_day',
        day: 'funday',
        offset: 1,
        claimedDay: 'monday',
      }),
    ).toEqual({ correct: false, ran: false, reason: 'MALFORMED_TASK' });
    expect(
      checkCalendarTask({
        kind: 'calendar_next_day',
        day: 'monday',
        offset: 9,
        claimedDay: 'wednesday',
      }).ran,
    ).toBe(false);
  });
});
