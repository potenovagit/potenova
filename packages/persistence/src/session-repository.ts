import { eq } from 'drizzle-orm';
import type { PotenovaDb } from './database';
import { diagnosticRun, tutoringSession, submission, usageLedger } from './schema';

/** Session persistence (WP-06/07/08). Diagnostic runs and tutoring sessions are
 *  resumable, so their state is durable (AT-04/06). The submission ledger is
 *  append-only so "at most one evidence event" holds across a restart (AT-27). */

export interface DiagnosticRunRow {
  runId: string;
  runVersion: number;
  learnerAlias: string;
  subject: string;
  curriculumReleaseId: string;
  state: string;
  probesUsed: number;
}
export interface TutoringSessionRow {
  sessionId: string;
  learnerAlias: string;
  subject: string;
  state: string;
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
}
