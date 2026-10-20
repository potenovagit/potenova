import { eq } from 'drizzle-orm';
import type { PotenovaDb } from './database';
import { family, guardian, learnerProfile, consentGrant } from './schema';

/** Identity, family and consent persistence (WP-01). Consent is durable — the
 *  consent fence must survive restarts (no processing before a stored grant). */

export interface FamilyRow {
  familyId: string;
  marketRegion: string;
  legalOwnerGuardianId: string;
  status: string;
}
export interface GuardianRow {
  guardianId: string;
  familyId: string;
  role: string;
  status: string;
}
export interface LearnerRow {
  learnerId: string;
  familyId: string;
  nickname: string;
  grade: number;
  ageBand: string;
  lifecycleStatus: string;
}
export interface ConsentGrantRow {
  grantId: string;
  familyId: string;
  purpose: string;
  version: string;
  modality: string;
  state: string;
  grantedAt: string;
  revokedAt: string | null;
}

export class IdentityRepository {
  constructor(private readonly h: PotenovaDb) {}

  async saveFamily(f: FamilyRow): Promise<void> {
    const db = await this.h.ready();
    await db
      .insert(family)
      .values(f)
      .onConflictDoUpdate({
        target: family.familyId,
        set: {
          marketRegion: f.marketRegion,
          legalOwnerGuardianId: f.legalOwnerGuardianId,
          status: f.status,
        },
      });
  }
  async getFamily(familyId: string): Promise<FamilyRow | null> {
    const db = await this.h.ready();
    const [r] = await db.select().from(family).where(eq(family.familyId, familyId));
    return r ?? null;
  }

  /** Set a family's account status (operator suspend/reactivate). No-op if the
   *  family does not exist (the caller checks existence first). */
  async setFamilyStatus(familyId: string, status: string): Promise<void> {
    const db = await this.h.ready();
    await db.update(family).set({ status }).where(eq(family.familyId, familyId));
  }

  /** Counts for the operator metrics view (synthetic scale). */
  async counts(): Promise<{ families: number; guardians: number; learners: number }> {
    const db = await this.h.ready();
    const [f, g, l] = await Promise.all([
      db.select({ id: family.familyId }).from(family),
      db.select({ id: guardian.guardianId }).from(guardian),
      db.select({ id: learnerProfile.learnerId }).from(learnerProfile),
    ]);
    return { families: f.length, guardians: g.length, learners: l.length };
  }

  async saveGuardian(g: GuardianRow): Promise<void> {
    const db = await this.h.ready();
    await db
      .insert(guardian)
      .values(g)
      .onConflictDoUpdate({
        target: guardian.guardianId,
        set: { familyId: g.familyId, role: g.role, status: g.status },
      });
  }

  async saveLearner(l: LearnerRow): Promise<void> {
    const db = await this.h.ready();
    await db
      .insert(learnerProfile)
      .values(l)
      .onConflictDoUpdate({
        target: learnerProfile.learnerId,
        set: {
          familyId: l.familyId,
          nickname: l.nickname,
          grade: l.grade,
          ageBand: l.ageBand,
          lifecycleStatus: l.lifecycleStatus,
        },
      });
  }
  async getLearner(learnerId: string): Promise<LearnerRow | null> {
    const db = await this.h.ready();
    const [r] = await db
      .select()
      .from(learnerProfile)
      .where(eq(learnerProfile.learnerId, learnerId));
    return r ?? null;
  }
  /** Every learner id under a family — drives the family-scope erasure cascade. */
  async listLearnerIdsByFamily(familyId: string): Promise<string[]> {
    const db = await this.h.ready();
    const rows = await db
      .select({ id: learnerProfile.learnerId })
      .from(learnerProfile)
      .where(eq(learnerProfile.familyId, familyId));
    return rows.map((r) => r.id);
  }

  async saveConsentGrant(c: ConsentGrantRow): Promise<void> {
    const db = await this.h.ready();
    await db
      .insert(consentGrant)
      .values(c)
      .onConflictDoUpdate({
        target: consentGrant.grantId,
        set: { state: c.state, revokedAt: c.revokedAt, version: c.version, modality: c.modality },
      });
  }
  async listConsentGrants(familyId: string): Promise<ConsentGrantRow[]> {
    const db = await this.h.ready();
    const rows = await db.select().from(consentGrant).where(eq(consentGrant.familyId, familyId));
    return rows.map((r) => ({ ...r }));
  }
}
