import { eq } from 'drizzle-orm';
import type { PotenovaDb } from './database';
import { contentAsset, assetQuarantine } from './schema';

/** Content persistence (WP-05). Asset lifecycle state is current-state; a
 *  quarantine record (with its regression case) is durable so a quarantined
 *  asset stays non-selectable across restarts (CONT-007/AT-49). */

export interface ContentAssetRow {
  assetId: string;
  assetVersion: string;
  state: string;
  provenance: string;
  subject: string;
  ageBand: string;
  producedBy: string;
  curriculumReleaseId: string;
}
export interface QuarantineRow {
  assetId: string;
  assetVersion: string;
  reasonCode: string;
  actor: string;
  at: string;
  regressionCaseId: string;
}

export class ContentRepository {
  constructor(private readonly h: PotenovaDb) {}

  async saveAsset(a: ContentAssetRow): Promise<void> {
    const db = await this.h.ready();
    await db
      .insert(contentAsset)
      .values(a)
      .onConflictDoUpdate({
        target: contentAsset.assetId,
        set: {
          assetVersion: a.assetVersion,
          state: a.state,
          provenance: a.provenance,
          subject: a.subject,
          ageBand: a.ageBand,
          producedBy: a.producedBy,
          curriculumReleaseId: a.curriculumReleaseId,
        },
      });
  }
  async getAsset(assetId: string): Promise<ContentAssetRow | null> {
    const db = await this.h.ready();
    const [r] = await db.select().from(contentAsset).where(eq(contentAsset.assetId, assetId));
    return r ?? null;
  }

  async quarantine(q: QuarantineRow): Promise<void> {
    const db = await this.h.ready();
    await db.insert(assetQuarantine).values(q).onConflictDoNothing();
  }
  async isQuarantined(assetId: string): Promise<boolean> {
    const db = await this.h.ready();
    const [r] = await db.select().from(assetQuarantine).where(eq(assetQuarantine.assetId, assetId));
    return r !== undefined;
  }
}
