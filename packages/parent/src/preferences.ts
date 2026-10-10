import {
  planReturnRetentionChecks,
  type RetentionCandidate,
  type RetentionCheck,
  type PlannerPolicy,
} from '@potenova/planner';
import { ESSENTIAL_NOTIFICATIONS, type NotificationKind } from './policy';

/**
 * Parent preference controls (PAR-007/009; AT-31).
 *
 * - Time ceilings: a parent may SHORTEN but never exceed the safety maximum
 *   (PAR-007). The effective cap is the smaller of the two.
 * - Vacation/Pause Mode: nonessential notifications are suppressed while
 *   essential (safety/account) ones still arrive; planned sessions pause; the
 *   return runs targeted retention checks, not a full re-placement (PAR-009;
 *   AT-31). Independent of billing.
 */

/** PAR-007: parent cap is honoured only up to the safety maximum. */
export function effectiveSessionCap(parentCapMinutes: number, safetyMaxMinutes: number): number {
  return Math.min(parentCapMinutes, safetyMaxMinutes);
}

/** AT-31: during Vacation Mode, only essential notifications are delivered. */
export function notificationAllowedDuringVacation(kind: NotificationKind): boolean {
  return ESSENTIAL_NOTIFICATIONS.has(kind);
}

export interface VacationReturn {
  readonly retentionChecks: readonly RetentionCheck[];
  /** Invariant (AT-31): return is targeted retention, never a full re-diagnostic. */
  readonly fullRediagnostic: false;
}

/** AT-31: returning from Vacation Mode schedules targeted retention checks (WP-07). */
export function onVacationReturn(
  candidates: readonly RetentionCandidate[],
  nowMs: number,
  policy: PlannerPolicy,
): VacationReturn {
  return {
    retentionChecks: planReturnRetentionChecks(candidates, nowMs, policy),
    fullRediagnostic: false,
  };
}
