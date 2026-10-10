import { and, eq, inArray } from 'drizzle-orm';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import type {
  MasteryEvidence,
  EvidenceCorrectionRecord,
  EvidenceMode,
  AssistanceBand,
} from '@potenova/learner-state';
import { masteryEvidence, evidenceCorrection, CREATE_TABLES_SQL } from './schema';

/**
 * Append-only evidence repository (WP-03 persistence; ADR-0002/0017).
 *
 * Storage for the immutable mastery-evidence ledger. The interface deliberately
 * offers inserts and reads only — there is no update or delete path, so a stored
 * observation can never be mutated; a correction is appended as its own record.
 * Inserts are idempotent on the primary key (re-ingesting the same event is a
 * no-op), which keeps "at most one evidence event" true across retries.
 */
export interface EvidenceRepository {
  appendEvidence(e: MasteryEvidence): Promise<void>;
  appendCorrection(c: EvidenceCorrectionRecord): Promise<void>;
  listEvidence(learnerAlias: string, skillId: string): Promise<MasteryEvidence[]>;
  listCorrections(targetEventIds: readonly string[]): Promise<EvidenceCorrectionRecord[]>;
  countEvidence(): Promise<number>;
  close(): Promise<void>;
}

export class PgliteEvidenceRepository implements EvidenceRepository {
  readonly #pg: PGlite;
  readonly #db: PgliteDatabase;
  #ready: Promise<void> | null = null;

  /** dataDir: a filesystem path to persist to, or undefined for in-memory (tests). */
  constructor(dataDir?: string) {
    this.#pg = dataDir ? new PGlite(dataDir) : new PGlite();
    this.#db = drizzle(this.#pg);
  }

  #init(): Promise<void> {
    if (!this.#ready) this.#ready = this.#pg.exec(CREATE_TABLES_SQL).then(() => undefined);
    return this.#ready;
  }

  async appendEvidence(e: MasteryEvidence): Promise<void> {
    await this.#init();
    await this.#db
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
      })
      .onConflictDoNothing();
  }

  async appendCorrection(c: EvidenceCorrectionRecord): Promise<void> {
    await this.#init();
    await this.#db
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

  async listEvidence(learnerAlias: string, skillId: string): Promise<MasteryEvidence[]> {
    await this.#init();
    const rows = await this.#db
      .select()
      .from(masteryEvidence)
      .where(
        and(eq(masteryEvidence.learnerAlias, learnerAlias), eq(masteryEvidence.skillId, skillId)),
      );
    return rows.map((r) => ({
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
    }));
  }

  async listCorrections(targetEventIds: readonly string[]): Promise<EvidenceCorrectionRecord[]> {
    await this.#init();
    if (targetEventIds.length === 0) return [];
    const rows = await this.#db
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
    await this.#init();
    const rows = await this.#db.select().from(masteryEvidence);
    return rows.length;
  }

  async close(): Promise<void> {
    await this.#pg.close();
  }
}

/** Open an evidence repository. Pass a directory to persist to disk, or omit for in-memory. */
export function openEvidenceRepository(dataDir?: string): EvidenceRepository {
  return new PgliteEvidenceRepository(dataDir);
}
