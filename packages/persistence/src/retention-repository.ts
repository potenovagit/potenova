import { inArray } from 'drizzle-orm';
import type { PotenovaDb } from './database';
import {
  masteryEvidence,
  diagnosticRun,
  usageLedger,
  securityAudit,
  entitlement,
  providerCallback,
} from './schema';

/**
 * Retention-sweep primitives (ER-07 / NFR-17 enforcement). Like erasure, applying
 * a lawful retention schedule deletes/ages records, so it lives outside the
 * append-only repositories. This exposes raw scans (record id + its retention
 * timestamp) and id-keyed deletes; the POLICY decision (which class, what age,
 * approved?) stays in the route against `@potenova/policy`, so this layer holds
 * no governance logic. The security audit log is itself a retention class here
 * (730-day purge in the proposed schedule) — distinct from erasure, where it is
 * never a target.
 */

export interface AgeableRow {
  id: string;
  /** The timestamp the record's retention clock runs from (ISO or YYYY-MM-DD). */
  ts: string;
}

export interface AgeableScan {
  usage: AgeableRow[];
  securityAudit: AgeableRow[];
  billing: AgeableRow[]; // entitlement + provider_callback, id-prefixed
}

export class RetentionRepository {
  constructor(private readonly h: PotenovaDb) {}

  /** Row counts for closure-basis / non-ageable stores, for the sweep report. */
  async storeCounts(): Promise<{ evidence: number; diagnosticRuns: number }> {
    const db = await this.h.ready();
    const ev = await db.select({ id: masteryEvidence.eventId }).from(masteryEvidence);
    const dr = await db.select({ id: diagnosticRun.runId }).from(diagnosticRun);
    return { evidence: ev.length, diagnosticRuns: dr.length };
  }

  /** Scan the from-creation, age-able stores with their retention timestamps. */
  async scanAgeable(): Promise<AgeableScan> {
    const db = await this.h.ready();
    const usage = (
      await db.select({ id: usageLedger.id, ts: usageLedger.day }).from(usageLedger)
    ).map((r) => ({ id: r.id, ts: r.ts }));
    const audit = (
      await db.select({ id: securityAudit.id, ts: securityAudit.at }).from(securityAudit)
    ).map((r) => ({ id: `audit:${r.id}`, ts: r.ts }));
    const ent = (
      await db.select({ id: entitlement.familyId, ts: entitlement.updatedAt }).from(entitlement)
    ).map((r) => ({ id: `ent:${r.id}`, ts: r.ts }));
    const cb = (
      await db
        .select({ id: providerCallback.callbackKey, ts: providerCallback.appliedAt })
        .from(providerCallback)
    ).map((r) => ({ id: `cb:${r.id}`, ts: r.ts }));
    return { usage, securityAudit: audit, billing: [...ent, ...cb] };
  }

  async deleteUsage(ids: readonly string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const db = await this.h.ready();
    const res = await db
      .delete(usageLedger)
      .where(inArray(usageLedger.id, [...ids]))
      .returning({ id: usageLedger.id });
    return res.length;
  }

  async deleteSecurityAudit(prefixedIds: readonly string[]): Promise<number> {
    const ids = prefixedIds
      .map((i) => Number(i.replace(/^audit:/, '')))
      .filter((n) => !Number.isNaN(n));
    if (ids.length === 0) return 0;
    const db = await this.h.ready();
    const res = await db
      .delete(securityAudit)
      .where(inArray(securityAudit.id, ids))
      .returning({ id: securityAudit.id });
    return res.length;
  }

  /** Delete billing rows (entitlement `ent:` + provider_callback `cb:`). */
  async deleteBilling(prefixedIds: readonly string[]): Promise<number> {
    const db = await this.h.ready();
    const entIds = prefixedIds.filter((i) => i.startsWith('ent:')).map((i) => i.slice(4));
    const cbIds = prefixedIds.filter((i) => i.startsWith('cb:')).map((i) => i.slice(3));
    let n = 0;
    if (entIds.length > 0) {
      n += (
        await db
          .delete(entitlement)
          .where(inArray(entitlement.familyId, entIds))
          .returning({ id: entitlement.familyId })
      ).length;
    }
    if (cbIds.length > 0) {
      n += (
        await db
          .delete(providerCallback)
          .where(inArray(providerCallback.callbackKey, cbIds))
          .returning({ id: providerCallback.callbackKey })
      ).length;
    }
    return n;
  }
}
