import { isApprovedRegion } from '@potenova/contracts';
import { type Deps } from './deps';

/**
 * Notification delivery worker (the outbox drain).
 *
 * The outbox (ADR-0041) records guardian-facing messages; this worker attempts
 * to DELIVER them through a provider (email/SMS). The provider is EVIDENCE
 * REQUIRED and residency/consent-bound — no approved, in-region provider is
 * wired yet — so the worker is FAIL-CLOSED, exactly like the AI gateway:
 *
 *   - no provider configured        → HELD_NO_PROVIDER (nothing is sent)
 *   - provider not in the Canadian  → BLOCKED_REGION  (residency gate, NFR-02)
 *     region allowlist
 *   - the subject family is gone     → HELD_NO_SUBJECT (consent/lifecycle: an
 *     (erased / closed)                erased subject is never messaged)
 *   - otherwise                      → DELIVERED via the provider
 *
 * Billing-recipient signals are internal and NOT delivered here — the billing
 * consumer processes those. In production this runs as a scheduled system job.
 */

export interface NotificationProvider {
  readonly id: string;
  /** The region the provider processes in — must be in the Canadian allowlist. */
  readonly region: string;
  send(input: {
    notificationId: string;
    recipient: string;
    familyId: string | null;
    kind: string;
    payload: string;
  }): Promise<void>;
}

/** In-memory provider for dev/staging + tests — never a production delivery path. */
export class StubNotificationProvider implements NotificationProvider {
  readonly sent: Array<{ notificationId: string; kind: string }> = [];
  constructor(
    readonly id = 'stub-notifier',
    readonly region = 'ca-central',
  ) {}
  async send(input: { notificationId: string; kind: string }): Promise<void> {
    this.sent.push({ notificationId: input.notificationId, kind: input.kind });
  }
}

export interface DeliverySummary {
  provider: string | null;
  delivered: number;
  heldNoProvider: number;
  blockedRegion: number;
  heldNoSubject: number;
}

export async function runNotificationDelivery(deps: Deps): Promise<DeliverySummary> {
  const provider = deps.notificationProvider;
  const pending = await deps.notifications.listPending();
  const external = pending.filter((n) => n.recipient === 'guardian');
  const summary: DeliverySummary = {
    provider: provider?.id ?? null,
    delivered: 0,
    heldNoProvider: 0,
    blockedRegion: 0,
    heldNoSubject: 0,
  };

  for (const n of external) {
    if (!provider) {
      await deps.notifications.markStatus(n.notificationId, 'HELD_NO_PROVIDER');
      summary.heldNoProvider++;
      continue;
    }
    if (!isApprovedRegion(provider.region)) {
      await deps.notifications.markStatus(n.notificationId, 'BLOCKED_REGION');
      summary.blockedRegion++;
      continue;
    }
    // Consent / lifecycle: never message a subject whose account is gone.
    if (n.familyId && !(await deps.identity.getFamily(n.familyId))) {
      await deps.notifications.markStatus(n.notificationId, 'HELD_NO_SUBJECT');
      summary.heldNoSubject++;
      continue;
    }
    await provider.send({
      notificationId: n.notificationId,
      recipient: n.recipient,
      familyId: n.familyId,
      kind: n.kind,
      payload: n.payload,
    });
    await deps.notifications.markStatus(n.notificationId, 'DELIVERED');
    summary.delivered++;
  }

  return summary;
}
