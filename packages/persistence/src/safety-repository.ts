import { desc, eq } from 'drizzle-orm';
import type { PotenovaDb } from './database';
import { securityAudit, dataSubjectRequest } from './schema';

/** Safety & privacy persistence (WP-11). The security audit is append-only and
 *  tamper-resistant (SEC-003) — it must outlive any process. Data-subject
 *  requests carry durable state so a deletion is never prematurely "complete". */

export interface AuditEventRow {
  approver: string;
  reason: string;
  object: string;
  action: string;
  outcome: string;
  expiry: string | null;
  at: string;
}
export interface DsrRow {
  requestId: string;
  kind: string;
  state: string;
  updatedAt: string;
}

export class SafetyRepository {
  constructor(private readonly h: PotenovaDb) {}

  /** Append an audit event (insert only — never updated or deleted). */
  async recordAudit(e: AuditEventRow): Promise<void> {
    const db = await this.h.ready();
    await db.insert(securityAudit).values(e);
  }
  async recentAudit(limit = 100): Promise<AuditEventRow[]> {
    const db = await this.h.ready();
    const rows = await db.select().from(securityAudit).orderBy(desc(securityAudit.id)).limit(limit);
    return rows.map((r) => ({
      approver: r.approver,
      reason: r.reason,
      object: r.object,
      action: r.action,
      outcome: r.outcome,
      expiry: r.expiry,
      at: r.at,
    }));
  }

  async saveDsr(d: DsrRow): Promise<void> {
    const db = await this.h.ready();
    await db
      .insert(dataSubjectRequest)
      .values(d)
      .onConflictDoUpdate({
        target: dataSubjectRequest.requestId,
        set: { state: d.state, updatedAt: d.updatedAt },
      });
  }
  async getDsr(requestId: string): Promise<DsrRow | null> {
    const db = await this.h.ready();
    const [r] = await db
      .select()
      .from(dataSubjectRequest)
      .where(eq(dataSubjectRequest.requestId, requestId));
    return r ?? null;
  }
}
