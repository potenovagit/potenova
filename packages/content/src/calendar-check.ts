import type { MathCheckReason } from './math-check';

/**
 * Deterministic calendar-day oracle (Ontario Grade 1 E2.3, the rule-decidable
 * slice: read and use a calendar — days of the week and what comes next). Given
 * a day and an offset ("what day is tomorrow if today is Wednesday?"), the day
 * is computed over the fixed weekly cycle and the learner's answer graded with
 * no model.
 *
 * Fail-closed: the day must be one of the seven weekday names (lower-case) and
 * the offset a whole number in [-7, 7]; otherwise the item is MALFORMED. The
 * cycle wraps (Saturday + 1 = Sunday).
 */

export const DAYS_OF_WEEK = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export interface CalendarNextDayTask {
  readonly kind: 'calendar_next_day';
  readonly day: string;
  readonly offset: number;
  /** The claimed resulting day (an answer key, or a learner's answer). */
  readonly claimedDay: string;
}

export interface CalendarCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

/** The day `offset` days after `day` in the weekly cycle, or null if `day` is
 *  not a weekday name. Wraps in both directions. */
export function dayAfter(day: string, offset: number): DayOfWeek | null {
  const i = (DAYS_OF_WEEK as readonly string[]).indexOf(day);
  if (i < 0 || !Number.isInteger(offset)) return null;
  return DAYS_OF_WEEK[(((i + offset) % 7) + 7) % 7]!;
}

export function checkCalendarTask(task: CalendarNextDayTask): CalendarCheckResult {
  if (task.kind !== 'calendar_next_day') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  const wellPosed =
    (DAYS_OF_WEEK as readonly string[]).includes(task.day) &&
    Number.isInteger(task.offset) &&
    task.offset >= -7 &&
    task.offset <= 7;
  if (!wellPosed) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  const correct = dayAfter(task.day, task.offset) === task.claimedDay;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
