import { desc } from 'drizzle-orm';
import type { PotenovaDb } from './database';
import { routeDecision } from './schema';

/**
 * AI route-decision log (AI-006). Append-only. Each entry captures the inputs
 * and result of one gateway routing decision — capability, requested/chosen
 * model, the outcome and the policy that decided it, the fallback/block reason,
 * the processing region and (when the route was invoked) the token units. It
 * carries identifiers and reason codes only, never child content.
 */

export interface RouteDecisionRow {
  decisionId: string;
  at: string;
  capability: string;
  requestedModel: string | null;
  chosenModel: string | null;
  outcome: string;
  policy: string;
  reasonCode: string | null;
  processingRegion: string;
  childContext: boolean;
  synthetic: boolean;
  units: number | null;
}

export class RouteDecisionRepository {
  constructor(private readonly h: PotenovaDb) {}

  async record(r: RouteDecisionRow): Promise<void> {
    const db = await this.h.ready();
    await db.insert(routeDecision).values(r);
  }

  async recent(limit = 50): Promise<RouteDecisionRow[]> {
    const db = await this.h.ready();
    const rows = await db.select().from(routeDecision).orderBy(desc(routeDecision.at)).limit(limit);
    return rows.map((r) => ({ ...r }));
  }

  async count(): Promise<number> {
    const db = await this.h.ready();
    const rows = await db.select({ id: routeDecision.decisionId }).from(routeDecision);
    return rows.length;
  }
}
