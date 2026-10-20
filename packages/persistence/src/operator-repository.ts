import { eq } from 'drizzle-orm';
import type { PotenovaDb } from './database';
import { killSwitch, incident, evalRun } from './schema';

/** Operator persistence (WP-13). A kill switch's disabled state is durable — a
 *  capability an operator disabled stays disabled across a restart/redeploy
 *  (SAFE-012). Incidents carry durable state for the queue (OPS-004/008). */

export interface IncidentRow {
  incidentId: string;
  stream: string;
  severity: string;
  owner: string;
  state: string;
  rcaAttached: boolean;
  regressionCaseId: string | null;
}

export interface EvalRunInput {
  modelId: string;
  kind: 'single' | 'suite';
  latencyMs: number;
  accuracy: number | null;
  containmentHeld: boolean;
  verdict: string;
  at: string;
}
export interface EvalRunStats {
  count: number;
  /** Nearest-rank P95 over recorded run latencies (ms). Reported, not SLO-judged. */
  p95LatencyMs: number;
  /** True iff every recorded eval run held containment (no incorrect delivery). */
  containmentHeldAll: boolean;
  last: {
    modelId: string;
    kind: string;
    verdict: string;
    accuracy: number | null;
    latencyMs: number;
    containmentHeld: boolean;
    at: string;
  } | null;
}

export class OperatorRepository {
  constructor(private readonly h: PotenovaDb) {}

  async setKillSwitch(input: {
    capability: string;
    disabled: boolean;
    actor: string;
    reason: string;
    at: string;
  }): Promise<void> {
    const db = await this.h.ready();
    await db
      .insert(killSwitch)
      .values(input)
      .onConflictDoUpdate({
        target: killSwitch.capability,
        set: { disabled: input.disabled, actor: input.actor, reason: input.reason, at: input.at },
      });
  }
  /** Active unless an explicit disabled row says otherwise (fails safe). */
  async isCapabilityActive(capability: string): Promise<boolean> {
    const db = await this.h.ready();
    const [r] = await db.select().from(killSwitch).where(eq(killSwitch.capability, capability));
    return r ? !r.disabled : true;
  }

  /** Capabilities currently disabled by a kill switch (operator metrics). */
  async disabledCapabilities(): Promise<string[]> {
    const db = await this.h.ready();
    const rows = await db
      .select({ capability: killSwitch.capability, disabled: killSwitch.disabled })
      .from(killSwitch);
    return rows.filter((r) => r.disabled).map((r) => r.capability);
  }

  async saveIncident(i: IncidentRow): Promise<void> {
    const db = await this.h.ready();
    await db
      .insert(incident)
      .values(i)
      .onConflictDoUpdate({
        target: incident.incidentId,
        set: {
          state: i.state,
          rcaAttached: i.rcaAttached,
          regressionCaseId: i.regressionCaseId,
          owner: i.owner,
        },
      });
  }
  async getIncident(incidentId: string): Promise<IncidentRow | null> {
    const db = await this.h.ready();
    const [r] = await db.select().from(incident).where(eq(incident.incidentId, incidentId));
    return r ?? null;
  }

  /** Append an immutable model-eval run record (latency/containment evidence). */
  async recordEvalRun(input: EvalRunInput): Promise<void> {
    const db = await this.h.ready();
    await db.insert(evalRun).values(input);
  }

  /** Aggregate the recorded eval runs for the operator surface. */
  async evalRunStats(): Promise<EvalRunStats> {
    const db = await this.h.ready();
    const rows = await db.select().from(evalRun);
    if (rows.length === 0) {
      return { count: 0, p95LatencyMs: 0, containmentHeldAll: true, last: null };
    }
    const latencies = rows.map((r) => r.latencyMs).sort((a, b) => a - b);
    const p95 = latencies[Math.min(latencies.length - 1, Math.ceil(0.95 * latencies.length) - 1)];
    const containmentHeldAll = rows.every((r) => r.containmentHeld);
    // Most recent by id (bigserial is monotonic with insertion).
    const last = rows.reduce((a, b) => (b.id > a.id ? b : a));
    return {
      count: rows.length,
      p95LatencyMs: p95,
      containmentHeldAll,
      last: {
        modelId: last.modelId,
        kind: last.kind,
        verdict: last.verdict,
        accuracy: last.accuracy ?? null,
        latencyMs: last.latencyMs,
        containmentHeld: last.containmentHeld,
        at: last.at,
      },
    };
  }
}
