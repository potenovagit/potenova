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
