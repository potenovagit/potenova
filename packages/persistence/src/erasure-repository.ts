import { eq, inArray } from 'drizzle-orm';
import type { PotenovaDb } from './database';
import {
  masteryEvidence,
  evidenceCorrection,
  tutoringSession,
  diagnosticRun,
  usageLedger,
  guardianPreference,
  learnerProfile,
  dataSubjectRequest,
} from './schema';

/**
 * First-party-store erasure (PRIV-005 / NFR-17 / TM-48).
 *
 * Right-to-erasure overrides the append-only evidence ledger for the subject,
 * so this is the ONE place that deletes a learner's rows — kept out of the
 * append-only repositories, which stay inserts-and-reads-only. It deletes the
 * learner's data across every first-party table and reports per-table counts so
 * the erasure is auditable. The security audit log is intentionally never an
 * erasure target (it holds reason codes, never child content; SEC-004/017).
 */

export interface LearnerDataCounts {
  evidence: number;
  corrections: number;
  sessions: number;
  diagnosticRuns: number;
  usageDays: number;
  preferences: number;
  profile: number;
}

export interface DataSubjectRequestRow {
  requestId: string;
  kind: string;
  subjectType?: string | null;
  subjectId?: string | null;
  reason?: string | null;
  state: string;
  outcomesJson?: string | null;
  updatedAt: string;
}

export class ErasureRepository {
  constructor(private readonly h: PotenovaDb) {}

  /** Delete every first-party row for a learner, returning per-table counts. */
  async deleteLearnerData(learnerAlias: string): Promise<LearnerDataCounts> {
    const db = await this.h.ready();

    // Corrections reference the learner's evidence events — remove them first.
    const events = await db
      .select({ eventId: masteryEvidence.eventId })
      .from(masteryEvidence)
      .where(eq(masteryEvidence.learnerAlias, learnerAlias));
    const eventIds = events.map((e) => e.eventId);
    let corrections = 0;
    if (eventIds.length > 0) {
      const delCorr = await db
        .delete(evidenceCorrection)
        .where(inArray(evidenceCorrection.targetEventId, eventIds))
        .returning({ id: evidenceCorrection.correctionId });
      corrections = delCorr.length;
    }

    const evidence = (
      await db
        .delete(masteryEvidence)
        .where(eq(masteryEvidence.learnerAlias, learnerAlias))
        .returning({ id: masteryEvidence.eventId })
    ).length;
    const sessions = (
      await db
        .delete(tutoringSession)
        .where(eq(tutoringSession.learnerAlias, learnerAlias))
        .returning({ id: tutoringSession.sessionId })
    ).length;
    const diagnosticRuns = (
      await db
        .delete(diagnosticRun)
        .where(eq(diagnosticRun.learnerAlias, learnerAlias))
        .returning({ id: diagnosticRun.runId })
    ).length;
    const usageDays = (
      await db
        .delete(usageLedger)
        .where(eq(usageLedger.learnerAlias, learnerAlias))
        .returning({ id: usageLedger.id })
    ).length;
    const preferences = (
      await db
        .delete(guardianPreference)
        .where(eq(guardianPreference.learnerAlias, learnerAlias))
        .returning({ id: guardianPreference.learnerAlias })
    ).length;
    const profile = (
      await db
        .delete(learnerProfile)
        .where(eq(learnerProfile.learnerId, learnerAlias))
        .returning({ id: learnerProfile.learnerId })
    ).length;

    return { evidence, corrections, sessions, diagnosticRuns, usageDays, preferences, profile };
  }

  async saveDataSubjectRequest(r: DataSubjectRequestRow): Promise<void> {
    const db = await this.h.ready();
    await db
      .insert(dataSubjectRequest)
      .values(r)
      .onConflictDoUpdate({
        target: dataSubjectRequest.requestId,
        set: { state: r.state, outcomesJson: r.outcomesJson ?? null, updatedAt: r.updatedAt },
      });
  }

  async getDataSubjectRequest(requestId: string): Promise<DataSubjectRequestRow | null> {
    const db = await this.h.ready();
    const [r] = await db
      .select()
      .from(dataSubjectRequest)
      .where(eq(dataSubjectRequest.requestId, requestId));
    return r ?? null;
  }
}
