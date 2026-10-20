import { and, desc, eq } from 'drizzle-orm';
import type { PotenovaDb } from './database';
import { securityAudit, dataSubjectRequest, dualAuthRequest } from './schema';

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
export interface DualAuthRequestRow {
  requestId: string;
  action: string;
  /** JSON-encoded action parameters. */
  params: string;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  status: string;
  approvedBy: string | null;
  decidedAt: string | null;
  expiresAt: string;
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

  /** Record a new (PENDING) dual-authorization request (SEC-003). */
  async createDualAuthRequest(r: DualAuthRequestRow): Promise<void> {
    const db = await this.h.ready();
    await db.insert(dualAuthRequest).values(r);
  }
  async getDualAuthRequest(requestId: string): Promise<DualAuthRequestRow | null> {
    const db = await this.h.ready();
    const [r] = await db
      .select()
      .from(dualAuthRequest)
      .where(eq(dualAuthRequest.requestId, requestId));
    return r ?? null;
  }
  async listPendingDualAuth(): Promise<DualAuthRequestRow[]> {
    const db = await this.h.ready();
    const rows = await db
      .select()
      .from(dualAuthRequest)
      .where(eq(dualAuthRequest.status, 'PENDING'))
      .orderBy(desc(dualAuthRequest.requestedAt));
    return rows.map((r) => ({ ...r }));
  }
  /** Transition a request. The `expect` guard makes approve/deny a compare-and-set
   *  (only a PENDING request transitions), so two approvers cannot double-consume. */
  async updateDualAuthStatus(
    requestId: string,
    next: { status: string; approvedBy?: string | null; decidedAt?: string | null },
    expect: string = 'PENDING',
  ): Promise<boolean> {
    const db = await this.h.ready();
    const rows = await db
      .update(dualAuthRequest)
      .set({
        status: next.status,
        approvedBy: next.approvedBy ?? null,
        decidedAt: next.decidedAt ?? null,
      })
      .where(and(eq(dualAuthRequest.requestId, requestId), eq(dualAuthRequest.status, expect)))
      .returning({ id: dualAuthRequest.requestId });
    return rows.length > 0;
  }
}
