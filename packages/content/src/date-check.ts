import type { MathCheckReason } from './math-check';

/**
 * Deterministic date-model oracle (Ontario Grade 1 E2.3, the fuller calendar
 * slice: read and use a calendar across month boundaries — "what is the date a
 * few days after March 30?"). A SELECTION task: the learner picks the resulting
 * date; the oracle computes it with a real date model (month lengths, leap
 * years, month rollover) and recomputes the correct choice.
 *
 * Same content-gate guarantee as every selection: each option is a candidate
 * {month, day}, the oracle derives the true date, and only a well-posed item —
 * exactly one option matches, and the result stays within the same year — is
 * delivered. Dates are 1-indexed (month 1–12, day 1–length).
 */

export interface CalendarDate {
  readonly month: number;
  readonly day: number;
}

export interface DateOffsetSelectTask {
  readonly kind: 'date_offset_select';
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly offset: number;
  readonly options: readonly CalendarDate[];
  /** The chosen date as a 0-based index (an answer key, or a learner's pick). */
  readonly claimedIndex: number;
}

export interface DateCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

const isInt = (n: number): boolean => Number.isInteger(n);

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) return 0;
  const lengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return lengths[month - 1]!;
}

const validDate = (year: number, month: number, day: number): boolean =>
  isInt(month) &&
  month >= 1 &&
  month <= 12 &&
  isInt(day) &&
  day >= 1 &&
  day <= daysInMonth(year, month);

/** The date `offset` days from the start date, or null if it leaves the year. */
export function addDays(
  year: number,
  month: number,
  day: number,
  offset: number,
): CalendarDate | null {
  if (!validDate(year, month, day) || !isInt(offset)) return null;
  let m = month;
  let d = day + offset;
  while (d > daysInMonth(year, m)) {
    d -= daysInMonth(year, m);
    m += 1;
    if (m > 12) return null; // left the year — out of this item's scope
  }
  while (d < 1) {
    m -= 1;
    if (m < 1) return null;
    d += daysInMonth(year, m);
  }
  return { month: m, day: d };
}

/** Indices of options equal to the computed date (the oracle's own key). */
export function matchingDateIndices(
  result: CalendarDate | null,
  options: readonly CalendarDate[],
): number[] {
  if (!result) return [];
  return options.flatMap((o, i) => (o.month === result.month && o.day === result.day ? [i] : []));
}

export function checkDateOffsetSelectTask(task: DateOffsetSelectTask): DateCheckResult {
  if (task.kind !== 'date_offset_select') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  const result = addDays(task.year, task.month, task.day, task.offset);
  const optionsOk =
    task.options.length >= 2 && task.options.every((o) => validDate(task.year, o.month, o.day));
  const wellPosed =
    result !== null &&
    optionsOk &&
    matchingDateIndices(result, task.options).length === 1 &&
    isInt(task.claimedIndex) &&
    task.claimedIndex >= 0 &&
    task.claimedIndex < task.options.length;
  if (!wellPosed) return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  const correctIndex = matchingDateIndices(result, task.options)[0]!;
  const correct = task.claimedIndex === correctIndex;
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
