import { and, eq, inArray } from 'drizzle-orm';
import type {
  MasteryEvidence,
  EvidenceCorrectionRecord,
  EvidenceMode,
  AssistanceBand,
} from '@potenova/learner-state';
import { PotenovaDb, openDatabase } from './database';
import { masteryEvidence, evidenceCorrection } from './schema';

/**
 * Append-only evidence repository (WP-03 persistence; ADR-0002/0017).
 *
 * Inserts and reads only — no update or delete — so a stored observation is
 * immutable; a correction is appended as its own record. Inserts are idempotent
 * on the primary key, keeping "at most one evidence event" true across retries.
 */
export class EvidenceRepository {
  constructor(private readonly h: PotenovaDb) {}

  async appendEvidence(e: MasteryEvidence): Promise<void> {
    const db = await this.h.ready();
    await db
      .insert(masteryEvidence)
      .values({
        eventId: e.eventId,
        learnerAlias: e.learnerAlias,
        skillId: e.skillId,
        mode: e.mode,
        assistanceBand: e.assistanceBand,
        correct: e.correct,
        representation: e.representation,
        recognitionConfidence: e.recognitionConfidence,
        observedAt: e.observedAt,
        curriculumReleaseId: e.curriculumReleaseId,
        schemaVersion: e.schemaVersion,
        evidenceDimension: e.evidenceDimension ?? null,
        itemFamilyId: e.itemFamilyId ?? null,
        gradeTarget: e.gradeTarget ?? null,
        sessionId: e.sessionId ?? null,
      })
      .onConflictDoNothing();
  }

  async appendCorrection(c: EvidenceCorrectionRecord): Promise<void> {
    const db = await this.h.ready();
    await db
      .insert(evidenceCorrection)
      .values({
        correctionId: c.correctionId,
        targetEventId: c.targetEventId,
        reason: c.reason,
        retract: c.retract,
        createdAt: c.createdAt,
      })
      .onConflictDoNothing();
  }

  /** Map a stored row back to MasteryEvidence, normalising nullable conceptual
   *  columns to the optional fields (null → absent) so the conceptual projection
   *  filter (`evidenceDimension !== undefined`) behaves identically to in-memory. */
  private static toEvidence(r: typeof masteryEvidence.$inferSelect): MasteryEvidence {
    return {
      eventId: r.eventId,
      learnerAlias: r.learnerAlias,
      skillId: r.skillId,
      mode: r.mode as EvidenceMode,
      assistanceBand: r.assistanceBand as AssistanceBand,
      correct: r.correct,
      representation: r.representation,
      recognitionConfidence: r.recognitionConfidence,
      observedAt: r.observedAt,
      curriculumReleaseId: r.curriculumReleaseId,
      schemaVersion: r.schemaVersion,
      ...(r.evidenceDimension != null
        ? { evidenceDimension: r.evidenceDimension as MasteryEvidence['evidenceDimension'] }
        : {}),
      ...(r.itemFamilyId != null ? { itemFamilyId: r.itemFamilyId } : {}),
      ...(r.gradeTarget != null ? { gradeTarget: r.gradeTarget } : {}),
      ...(r.sessionId != null ? { sessionId: r.sessionId } : {}),
    };
  }

  async listEvidence(learnerAlias: string, skillId: string): Promise<MasteryEvidence[]> {
    const db = await this.h.ready();
    const rows = await db
      .select()
      .from(masteryEvidence)
      .where(
        and(eq(masteryEvidence.learnerAlias, learnerAlias), eq(masteryEvidence.skillId, skillId)),
      );
    return rows.map((r) => EvidenceRepository.toEvidence(r));
  }

  /** All evidence for a learner across skills (for session-scoped reports). */
  async listEvidenceForLearner(learnerAlias: string): Promise<MasteryEvidence[]> {
    const db = await this.h.ready();
    const rows = await db
      .select()
      .from(masteryEvidence)
      .where(eq(masteryEvidence.learnerAlias, learnerAlias));
    return rows.map((r) => EvidenceRepository.toEvidence(r));
  }

  async listCorrections(targetEventIds: readonly string[]): Promise<EvidenceCorrectionRecord[]> {
    if (targetEventIds.length === 0) return [];
    const db = await this.h.ready();
    const rows = await db
      .select()
      .from(evidenceCorrection)
      .where(inArray(evidenceCorrection.targetEventId, [...targetEventIds]));
    return rows.map((r) => ({
      correctionId: r.correctionId,
      targetEventId: r.targetEventId,
      reason: r.reason,
      retract: r.retract,
      createdAt: r.createdAt,
    }));
  }

  async countEvidence(): Promise<number> {
    const db = await this.h.ready();
    return (await db.select().from(masteryEvidence)).length;
  }
}

/** Convenience: open a standalone database holding just an evidence repository. */
export function openEvidenceRepository(
  dataDir?: string,
): EvidenceRepository & { close(): Promise<void> } {
  const h = openDatabase(dataDir);
  const repo = new EvidenceRepository(h);
  return Object.assign(repo, { close: () => h.close() });
}
