import type { TutoringSessionRow } from '@potenova/persistence';
import type { Deps } from './deps';

/**
 * Early-end usage reconciliation (ER-09). A session reserves its full allotment
 * against the daily cap at start (so the cap holds conservatively across
 * concurrent sessions). When the session ends — a child stops early, the item
 * budget is reached, or every coachable skill is mastered — the UNUSED part of
 * that reservation is refunded, so stopping early doesn't burn the whole day's
 * time. Reconciliation runs once, on the ACTIVE → ended transition.
 *
 * Time-based, matching the cap's unit (minutes): actual = min(reserved, elapsed).
 */
export async function reconcileUsageOnEnd(
  deps: Deps,
  row: TutoringSessionRow,
  nowMs: number = Date.now(),
): Promise<number> {
  // Only an ACTIVE session has a live reservation to reconcile.
  if (row.state !== 'ACTIVE') return 0;
  if (row.reservedMinutes == null || !row.startedAt) return 0;
  const startedMs = Date.parse(row.startedAt);
  if (Number.isNaN(startedMs)) return 0;
  const elapsedMin = Math.max(0, Math.ceil((nowMs - startedMs) / 60_000));
  const actual = Math.min(row.reservedMinutes, elapsedMin);
  const refund = row.reservedMinutes - actual;
  if (refund > 0) {
    const day = row.startedAt.slice(0, 10); // the reservation's UTC day
    await deps.session.reduceUsageMinutes(row.learnerAlias, day, refund);
  }
  return refund;
}
