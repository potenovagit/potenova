import { now, type Deps } from './deps';

/**
 * Billing-signal consumer (the billing side of the outbox).
 *
 * Account suspend/reactivate enqueue `billing_hold` / `billing_resume` signals
 * (ADR-0041). This consumer drains them and applies a billing HOLD — invoicing
 * paused — via a flag that is deliberately SEPARATE from the entitlement state
 * machine. Entitlement has no administrative "suspended" state, and suspension
 * already supersedes entitlement at the session edge; the billing service owns
 * its lifecycle and must not be driven out-of-band by the operator console. So
 * the hold is an overlay the billing service honours, never an entitlement
 * transition. Each processed signal is marked PROCESSED and audited. In
 * production this runs as a scheduled system job.
 */

export interface BillingSignalSummary {
  held: number;
  resumed: number;
  processed: number;
}

export async function runBillingSignalProcessing(deps: Deps): Promise<BillingSignalSummary> {
  const pending = await deps.notifications.listPending();
  const signals = pending.filter((n) => n.recipient === 'billing');
  const summary: BillingSignalSummary = { held: 0, resumed: 0, processed: 0 };

  for (const n of signals) {
    const at = now();
    if (n.familyId && n.kind === 'billing_hold') {
      await deps.billing.setHold(n.familyId, true, at);
      summary.held++;
    } else if (n.familyId && n.kind === 'billing_resume') {
      await deps.billing.setHold(n.familyId, false, at);
      summary.resumed++;
    }
    await deps.notifications.markStatus(n.notificationId, 'PROCESSED');
    summary.processed++;
    await deps.safety.recordAudit({
      approver: 'system:billing_consumer',
      reason: 'billing_signal',
      object: n.familyId ? `family:${n.familyId}` : `notification:${n.notificationId}`,
      action: `billing_signal_processed:${n.kind}`,
      outcome: 'EXECUTED',
      expiry: null,
      at,
    });
  }
  return summary;
}
