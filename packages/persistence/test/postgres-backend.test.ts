import { describe, it, expect, afterAll } from 'vitest';
import { openDatabaseFromEnv, EvidenceRepository, type PotenovaDb } from '../src';
import type { MasteryEvidence } from '@potenova/learner-state';

/**
 * Proves the production backend: the SAME repository code that runs on PGlite in
 * dev runs unchanged against a real Postgres server when DATABASE_URL is set
 * (ADR-0017 — "only the connection changes"). Skipped automatically when no
 * DATABASE_URL is present, so CI without a database stays green; run locally
 * against a Postgres with DATABASE_URL + DATABASE_SSL=false.
 */
const hasDb = !!process.env.DATABASE_URL;

const ev = (eventId: string): MasteryEvidence => ({
  eventId,
  learnerAlias: 'lnr-pg',
  skillId: 'SK-PG',
  mode: 'independent_check',
  assistanceBand: 'A0',
  correct: true,
  representation: 'area-model',
  recognitionConfidence: 1,
  observedAt: '2026-10-10T00:00:00Z',
  curriculumReleaseId: 'REL-ONT-MATH-2020-draft',
  schemaVersion: 'evt-0.1',
});

describe.skipIf(!hasDb)('managed Postgres backend (ADR-0017)', () => {
  let db: PotenovaDb;
  afterAll(async () => {
    if (db) await db.close();
  });

  it('selects the postgres backend and runs the same repository code', async () => {
    db = openDatabaseFromEnv(process.env);
    expect(db.backend).toBe('postgres');
    const repo = new EvidenceRepository(db);
    const id = `e-${Date.now()}`;
    await repo.appendEvidence(ev(id));
    const rows = await repo.listEvidence('lnr-pg', 'SK-PG');
    expect(rows.some((r) => r.eventId === id)).toBe(true);
  });

  it('keeps append-only inserts idempotent on the real driver', async () => {
    const repo = new EvidenceRepository(db);
    const id = `dup-${Date.now()}`;
    await repo.appendEvidence(ev(id));
    await repo.appendEvidence(ev(id)); // same primary key again
    const rows = await repo.listEvidence('lnr-pg', 'SK-PG');
    expect(rows.filter((r) => r.eventId === id).length).toBe(1);
  });
});
