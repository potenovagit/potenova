import { eq } from 'drizzle-orm';
import type { PotenovaDb } from './database';
import { entitlement, providerCallback } from './schema';

/** Billing persistence (WP-12). Entitlement is current-state per family; the
 *  provider-callback ledger is append-only so idempotency survives restarts —
 *  a duplicate store callback after a restart still cannot create a second grant. */

export interface EntitlementRow {
  familyId: string;
  state: string;
  tierId: string | null;
  updatedAt: string;
}

export class BillingRepository {
  constructor(private readonly h: PotenovaDb) {}

  async saveEntitlement(e: EntitlementRow): Promise<void> {
    const db = await this.h.ready();
    await db
      .insert(entitlement)
      .values(e)
      .onConflictDoUpdate({
        target: entitlement.familyId,
        set: { state: e.state, tierId: e.tierId, updatedAt: e.updatedAt },
      });
  }
  async getEntitlement(familyId: string): Promise<EntitlementRow | null> {
    const db = await this.h.ready();
    const [r] = await db.select().from(entitlement).where(eq(entitlement.familyId, familyId));
    return r ?? null;
  }

  /** Durable idempotency: returns whether this callback was newly applied. */
  async recordCallback(input: {
    channel: string;
    transactionId: string;
    familyId: string;
    kind: string;
    at: string;
  }): Promise<{ applied: boolean; duplicate: boolean }> {
    const db = await this.h.ready();
    const callbackKey = `${input.channel}:${input.transactionId}`;
    const res = await db
      .insert(providerCallback)
      .values({
        callbackKey,
        channel: input.channel,
        transactionId: input.transactionId,
        familyId: input.familyId,
        kind: input.kind,
        appliedAt: input.at,
      })
      .onConflictDoNothing()
      .returning({ callbackKey: providerCallback.callbackKey });
    const applied = res.length > 0;
    return { applied, duplicate: !applied };
  }
}
