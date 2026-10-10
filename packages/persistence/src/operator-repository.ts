import { eq } from 'drizzle-orm';
import type { PotenovaDb } from './database';
import { killSwitch, incident } from './schema';

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
}
