/**
 * Parent-experience policy (WP-10).
 *
 * Notification classes and subject-emphasis options. Essential notifications
 * (safety, account/billing-critical) are always delivered; the rest are
 * suppressible under Vacation Mode (PAR-009; AT-31). Per-band time ceilings and
 * safety maxima are EVIDENCE REQUIRED (ER-09) and supplied by the caller — not
 * fixed here.
 */

export const NOTIFICATION_KINDS = [
  'safety',
  'account',
  'learning_progress',
  'streak_reminder',
  'marketing',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** Essential notifications are never suppressed, even in Vacation Mode. */
export const ESSENTIAL_NOTIFICATIONS: ReadonlySet<NotificationKind> = new Set<NotificationKind>([
  'safety',
  'account',
]);

export const SUBJECT_EMPHASIS = ['balanced', 'more_math', 'more_english'] as const;
export type SubjectEmphasis = (typeof SUBJECT_EMPHASIS)[number];
