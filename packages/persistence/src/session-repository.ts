import { eq } from 'drizzle-orm';
import type { PotenovaDb } from './database';
import {
  diagnosticRun,
  tutoringSession,
  submission,
  usageLedger,
  guardianPreference,
} from './schema';

/** Session persistence (WP-06/07/08). Diagnostic runs and tutoring sessions are
 *  resumable, so their state is durable (AT-04/06). The submission ledger is
 *  append-only so "at most one evidence event" holds across a restart (AT-27). */

export interface DiagnosticRunRow {
  runId: string;
  runVersion: number;
  learnerAlias: string;
  subject: string;
  /** Strand/course the run probes; null = subject default. */
  strand?: string | null;
  curriculumReleaseId: string;
  state: string;
  probesUsed: number;
}
export interface TutoringSessionRow {
  sessionId: string;
  learnerAlias: string;
  subject: string;
  state: string;
  /** Strand/course within the subject; null = the subject's default course. */
  strand?: string | null;
  /** When the session went ACTIVE (ISO); for early-end usage reconciliation. */
  startedAt?: string | null;
  /** Minutes reserved against the daily cap at start. */
  reservedMinutes?: number | null;
}
export interface GuardianPreferenceRow {
  learnerAlias: string;
  /** A subject→strand focus (both set together, or both null). */
  focusSubject?: string | null;
  focusStrand?: string | null;
  /** A within-course skill the guardian wants prioritised (tie-break only). */
  focusSkillId?: string | null;
  /** Tightened usage limits (minutes). Null = no parent limit for that dimension. */
  maxDailyMinutes?: number | null;
  maxContinuousMinutes?: number | null;
}

export class SessionRepository {
  constructor(private readonly h: PotenovaDb) {}

  async saveDiagnosticRun(r: DiagnosticRunRow): Promise<void> {
    const db = await this.h.ready();
    await db
      .insert(diagnosticRun)
      .values(r)
      .onConflictDoUpdate({
        target: diagnosticRun.runId,
        set: { state: r.state, probesUsed: r.probesUsed, runVersion: r.runVersion },
      });
  }
  async getDiagnosticRun(runId: string): Promise<DiagnosticRunRow | null> {
    const db = await this.h.ready();
    const [r] = await db.select().from(diagnosticRun).where(eq(diagnosticRun.runId, runId));
    return r ?? null;
  }

  async saveTutoringSession(s: TutoringSessionRow): Promise<void> {
    const db = await this.h.ready();
    await db
      .insert(tutoringSession)
      .values(s)
      .onConflictDoUpdate({ target: tutoringSession.sessionId, set: { state: s.state } });
  }
  async getTutoringSession(sessionId: string): Promise<TutoringSessionRow | null> {
    const db = await this.h.ready();
    const [r] = await db
      .select()
      .from(tutoringSession)
      .where(eq(tutoringSession.sessionId, sessionId));
    return r ?? null;
  }

  /** Durable at-most-once submission. Returns whether this was newly recorded. */
  async recordSubmission(clientSubmissionId: string, at: string): Promise<{ accepted: boolean }> {
    const db = await this.h.ready();
    const res = await db
      .insert(submission)
      .values({ clientSubmissionId, at })
      .onConflictDoNothing()
      .returning({ id: submission.clientSubmissionId });
    return { accepted: res.length > 0 };
  }

  /** Minutes a learner has used on a given UTC day (0 if none). */
  async getUsageMinutes(learnerAlias: string, day: string): Promise<number> {
    const db = await this.h.ready();
    const [r] = await db
      .select()
      .from(usageLedger)
      .where(eq(usageLedger.id, `${learnerAlias}:${day}`));
    return r?.minutesUsed ?? 0;
  }

  /** Add to a learner's usage for a day (ER-09 enforcement across sessions). */
  async addUsageMinutes(learnerAlias: string, day: string, minutes: number): Promise<void> {
    const db = await this.h.ready();
    const id = `${learnerAlias}:${day}`;
    const next = (await this.getUsageMinutes(learnerAlias, day)) + minutes;
    await db
      .insert(usageLedger)
      .values({ id, learnerAlias, day, minutesUsed: next })
      .onConflictDoUpdate({ target: usageLedger.id, set: { minutesUsed: next } });
  }

  /** Release reserved minutes back to a day's usage (clamped at 0). Used by
   *  early-end reconciliation to refund the unused part of a reservation. */
  async reduceUsageMinutes(learnerAlias: string, day: string, minutes: number): Promise<void> {
    if (minutes <= 0) return;
    const current = await this.getUsageMinutes(learnerAlias, day);
    const next = Math.max(0, current - minutes);
    const db = await this.h.ready();
    const id = `${learnerAlias}:${day}`;
    await db
      .insert(usageLedger)
      .values({ id, learnerAlias, day, minutesUsed: next })
      .onConflictDoUpdate({ target: usageLedger.id, set: { minutesUsed: next } });
  }

  /** Guardian controls for a learner (focus + tightened caps), or null. */
  async getGuardianPreference(learnerAlias: string): Promise<GuardianPreferenceRow | null> {
    const db = await this.h.ready();
    const [r] = await db
      .select()
      .from(guardianPreference)
      .where(eq(guardianPreference.learnerAlias, learnerAlias));
    return r ?? null;
  }

  /** Upsert a learner's guardian controls (replaces the whole row). */
  async saveGuardianPreference(p: GuardianPreferenceRow): Promise<void> {
    const db = await this.h.ready();
    await db
      .insert(guardianPreference)
      .values(p)
      .onConflictDoUpdate({
        target: guardianPreference.learnerAlias,
        set: {
          focusSubject: p.focusSubject ?? null,
          focusStrand: p.focusStrand ?? null,
          focusSkillId: p.focusSkillId ?? null,
          maxDailyMinutes: p.maxDailyMinutes ?? null,
          maxContinuousMinutes: p.maxContinuousMinutes ?? null,
        },
      });
  }
}
