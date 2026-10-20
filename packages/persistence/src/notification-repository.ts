import { desc, eq } from 'drizzle-orm';
import type { PotenovaDb } from './database';
import { notification } from './schema';

/**
 * Notification outbox. A durable, enqueue-only queue that a real delivery worker
 * would drain: guardian-facing messages (account suspended/reactivated) and
 * signals the billing service consumes (hold/resume invoicing). The app never
 * delivers here — no email/SMS provider is wired pre-G2, and any such delivery
 * must honour Canadian residency and consent — it only records the intent.
 */

export interface NotificationRow {
  notificationId: string;
  /** Logical recipient — e.g. 'guardian' or 'billing' (the billing service). */
  recipient: string;
  familyId: string | null;
  kind: string;
  /** JSON-encoded notification payload. */
  payload: string;
  status: string;
  createdAt: string;
}

export class NotificationRepository {
  constructor(private readonly h: PotenovaDb) {}

  /** Enqueue a notification as PENDING (delivery is a separate, out-of-scope worker). */
  async enqueue(r: Omit<NotificationRow, 'status'> & { status?: string }): Promise<void> {
    const db = await this.h.ready();
    await db.insert(notification).values({ ...r, status: r.status ?? 'PENDING' });
  }

  async listPending(limit = 100): Promise<NotificationRow[]> {
    const db = await this.h.ready();
    const rows = await db
      .select()
      .from(notification)
      .where(eq(notification.status, 'PENDING'))
      .orderBy(desc(notification.createdAt))
      .limit(limit);
    return rows.map((r) => ({ ...r }));
  }

  async pendingCount(): Promise<number> {
    const db = await this.h.ready();
    const rows = await db
      .select({ id: notification.notificationId })
      .from(notification)
      .where(eq(notification.status, 'PENDING'));
    return rows.length;
  }

  async listForFamily(familyId: string): Promise<NotificationRow[]> {
    const db = await this.h.ready();
    const rows = await db
      .select()
      .from(notification)
      .where(eq(notification.familyId, familyId))
      .orderBy(desc(notification.createdAt));
    return rows.map((r) => ({ ...r }));
  }
}
