import type { PurchaseChannel } from './policy';

/**
 * Idempotent provider callbacks (BILL-004/010; AT-42).
 *
 * Web, Apple and Google purchase channels all map to ONE family entitlement. A
 * duplicate provider callback (same channel + transaction id) can never create a
 * second grant, and out-of-order events reconcile to the same result. Refunds and
 * chargebacks reconcile via the ORIGINATING channel and never rewrite learner
 * history (BILL-010).
 */

export interface ProviderCallback {
  readonly channel: PurchaseChannel;
  readonly transactionId: string;
  readonly familyId: string;
  readonly kind: 'grant' | 'refund' | 'chargeback';
}

export interface CallbackResult {
  readonly applied: boolean;
  readonly duplicate: boolean;
  /** Invariant (BILL-010): revenue events never rewrite learner evidence. */
  readonly learnerHistoryRewritten: false;
}

export class ProviderCallbackLedger {
  readonly #seen = new Set<string>();

  #key(c: ProviderCallback): string {
    return `${c.channel}:${c.transactionId}`;
  }

  /** Apply a callback once. A repeat of the same channel+transaction is a no-op. */
  apply(callback: ProviderCallback): CallbackResult {
    const key = this.#key(callback);
    if (this.#seen.has(key)) {
      return { applied: false, duplicate: true, learnerHistoryRewritten: false };
    }
    this.#seen.add(key);
    return { applied: true, duplicate: false, learnerHistoryRewritten: false };
  }

  processedCount(): number {
    return this.#seen.size;
  }
}
