import { desc } from 'drizzle-orm';
import type { PotenovaDb } from './database';
import { aiUsageEvent } from './schema';

/**
 * AI usage/cost persistence (AI-013 / AI-020). Append-only, privacy-safe: an
 * event carries aliases only (never raw child content — the AI gateway's cost
 * guard enforces that upstream) and the authoritative token `units`. Cost is
 * NOT stored — it is derived from a DRAFT, unapproved per-unit rate on read, so
 * recalibrating the rate never leaves stale figures in the ledger.
 *
 * Pre-G2 the only producer is the synthetic eval path (no family/learner); the
 * alias columns are ready for approved child routing at G2.
 */

export interface AiUsageEventRow {
  eventId: string;
  at: string;
  synthetic: boolean;
  kind: string;
  capability: string;
  provider: string;
  model: string;
  units: number;
  familyAlias: string | null;
  learnerAlias: string | null;
  sessionId: string | null;
}

export interface AiUsageBreakdown {
  key: string;
  events: number;
  units: number;
}

export class AiUsageRepository {
  constructor(private readonly h: PotenovaDb) {}

  async recordUsage(e: AiUsageEventRow): Promise<void> {
    const db = await this.h.ready();
    await db.insert(aiUsageEvent).values(e);
  }

  async summary(): Promise<{ events: number; totalUnits: number }> {
    const db = await this.h.ready();
    const rows = await db.select({ units: aiUsageEvent.units }).from(aiUsageEvent);
    return { events: rows.length, totalUnits: rows.reduce((s, r) => s + r.units, 0) };
  }

  /** Usage grouped by a dimension — model / capability / provider (AI-013). */
  async breakdown(by: 'model' | 'capability' | 'provider'): Promise<AiUsageBreakdown[]> {
    const db = await this.h.ready();
    const col =
      by === 'model'
        ? aiUsageEvent.model
        : by === 'capability'
          ? aiUsageEvent.capability
          : aiUsageEvent.provider;
    const rows = await db.select({ key: col, units: aiUsageEvent.units }).from(aiUsageEvent);
    const acc = new Map<string, { events: number; units: number }>();
    for (const r of rows) {
      const cur = acc.get(r.key) ?? { events: 0, units: 0 };
      cur.events += 1;
      cur.units += r.units;
      acc.set(r.key, cur);
    }
    return [...acc.entries()].map(([key, v]) => ({ key, ...v }));
  }

  async recent(limit = 50): Promise<AiUsageEventRow[]> {
    const db = await this.h.ready();
    const rows = await db.select().from(aiUsageEvent).orderBy(desc(aiUsageEvent.at)).limit(limit);
    return rows.map((r) => ({ ...r }));
  }
}
