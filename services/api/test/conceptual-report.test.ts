import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, EvidenceRepository, type PotenovaDb } from '@potenova/persistence';
import type { MasteryEvidence } from '@potenova/learner-state';

/**
 * Guardian conceptual-understanding read (ER-03) over the persisted ledger.
 *
 * The derived conceptual projection surfaced through the HTTP edge: a pure replay
 * of the immutable evidence ledger, grade-gated fail-closed, advisory (candidate
 * policy). Mastery is never set here — the endpoint only reads.
 *
 * NB: a validated conceptual-PROBE coaching path (dimension-tagged turns reaching
 * a child) depends on educator-authored, content-gated probe pools (Workstream-A,
 * pending sign-off). This test therefore seeds dimension-tagged evidence directly
 * onto the ledger — synthetic, no child-facing unvalidated content — and exercises
 * the READ/report surface end-to-end.
 */

const env = { APP_ENV: 'staging', PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' };
const g1 = {
  'x-actor-type': 'guardian',
  'x-actor-alias': 'g1',
  'x-guardian-role': 'owner',
  'x-family-alias': 'fam1',
};
const g2 = {
  'x-actor-type': 'guardian',
  'x-actor-alias': 'g2',
  'x-guardian-role': 'owner',
  'x-family-alias': 'fam2',
};
const child = { 'x-actor-type': 'child', 'x-actor-alias': 'kid1', 'x-family-alias': 'fam1' };

let dbs: PotenovaDb[] = [];
afterEach(async () => {
  await Promise.all(dbs.map((d) => d.close()));
  dbs = [];
});

const json = (headers: Record<string, string>, body?: unknown) => ({
  method: body === undefined ? 'GET' : 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

const D1 = '2026-11-01T10:00:00Z';
const D2 = '2026-11-02T10:00:00Z';

/** A complete SK-FR-equiv conceptual master bundle at `grade`, tagged for one
 *  learner. 5 distinct families, 2 sessions, 2 representations, all unaided. */
async function seedConceptualBundle(
  db: PotenovaDb,
  learnerAlias: string,
  grade: number,
  opts: { reasoningCorrect?: boolean } = {},
): Promise<void> {
  const repo = new EvidenceRepository(db);
  const base = {
    learnerAlias,
    skillId: 'SK-FR-equiv',
    assistanceBand: 'A0',
    recognitionConfidence: 1,
    curriculumReleaseId: 'REL-ONT-MATH-2020-draft',
    schemaVersion: 'evt-0.1',
    gradeTarget: grade,
  } as const;
  const bundle: MasteryEvidence[] = [
    {
      ...base,
      eventId: `${learnerAlias}-m1`,
      mode: 'independent_check',
      correct: true,
      representation: 'area-model',
      observedAt: D1,
      evidenceDimension: 'model',
      itemFamilyId: 'm1',
      sessionId: 's1',
    },
    {
      ...base,
      eventId: `${learnerAlias}-v1`,
      mode: 'independent_check',
      correct: true,
      representation: 'symbolic',
      observedAt: D1,
      evidenceDimension: 'value',
      itemFamilyId: 'v1',
      sessionId: 's1',
    },
    {
      ...base,
      eventId: `${learnerAlias}-v2`,
      mode: 'independent_check',
      correct: true,
      representation: 'area-model',
      observedAt: D2,
      evidenceDimension: 'value',
      itemFamilyId: 'v2',
      sessionId: 's2',
    },
    {
      ...base,
      eventId: `${learnerAlias}-r1`,
      mode: 'independent_check',
      correct: opts.reasoningCorrect ?? true,
      representation: 'symbolic',
      observedAt: D2,
      evidenceDimension: 'reasoning',
      itemFamilyId: 'r1',
      sessionId: 's2',
    },
    {
      ...base,
      eventId: `${learnerAlias}-t1`,
      mode: 'transfer_check',
      correct: true,
      representation: 'number-line',
      observedAt: D2,
      evidenceDimension: 'transfer',
      itemFamilyId: 't1',
      sessionId: 's2',
    },
  ];
  for (const e of bundle) await repo.appendEvidence(e);
}

async function setup() {
  const db = openDatabase();
  dbs.push(db);
  const app = createApp({ env, db });
  await app.request(
    '/families',
    json(g1, { familyId: 'fam1', marketRegion: 'ca-on', legalOwnerGuardianId: 'g1' }),
  );
  await app.request(
    '/families',
    json(g2, { familyId: 'fam2', marketRegion: 'ca-on', legalOwnerGuardianId: 'g2' }),
  );
  // kid1: grade 3, full master bundle. kid5: grade 5, SAME grade-3 evidence.
  // kid3: grade 3, reasoning wrong. kid2: fam2's learner (isolation).
  await app.request(
    '/families/fam1/learners',
    json(g1, { learnerId: 'kid1', nickname: 'A', grade: 3 }),
  );
  await app.request(
    '/families/fam1/learners',
    json(g1, { learnerId: 'kid5', nickname: 'B', grade: 5 }),
  );
  await app.request(
    '/families/fam1/learners',
    json(g1, { learnerId: 'kid3', nickname: 'C', grade: 3 }),
  );
  await app.request(
    '/families/fam2/learners',
    json(g2, { learnerId: 'kid2', nickname: 'D', grade: 3 }),
  );

  await seedConceptualBundle(db, 'kid1', 3);
  await seedConceptualBundle(db, 'kid5', 3); // grade-3 evidence, grade-5 learner
  await seedConceptualBundle(db, 'kid3', 3, { reasoningCorrect: false });
  return app;
}

describe('guardian conceptual read (ER-03) over the persisted ledger', () => {
  it('a complete grade-3 bundle reads INDEPENDENT with all dimensions met — advisory, candidate policy', async () => {
    const app = await setup();
    const res = await app.request('/learners/kid1/conceptual/SK-FR-equiv', json(g1));
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.state).toBe('INDEPENDENT');
    expect(b.gradeTarget).toBe(3);
    expect(b.policyApproved).toBe(false); // ER-03 candidate — advisory, not an approved decision
    expect(b.policyVersion).toContain('CANDIDATE');
    expect(b.unmet).toHaveLength(0);
    for (const d of b.dimensions) expect(d.met).toBe(true);
  });

  it('is fail-closed on grade: grade-3 evidence yields no claim for a grade-5 learner', async () => {
    const app = await setup();
    const res = await app.request('/learners/kid5/conceptual/SK-FR-equiv', json(g1));
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.gradeTarget).toBe(5);
    expect(b.state).toBe('UNKNOWN');
  });

  it('a wrong reasoning answer withholds mastery even with the value right', async () => {
    const app = await setup();
    const res = await app.request('/learners/kid3/conceptual/SK-FR-equiv', json(g1));
    const b = await res.json();
    expect(b.state).toBe('NOT_YET_DEMONSTRATED');
    expect(b.unmet.some((u: string) => u.startsWith('reasoning'))).toBe(true);
  });

  it('is guardian-only: a child actor is rejected', async () => {
    const app = await setup();
    const res = await app.request('/learners/kid1/conceptual/SK-FR-equiv', json(child));
    expect(res.status).toBe(403);
  });

  it('is tenant-isolated: a guardian cannot read a learner outside their family', async () => {
    const app = await setup();
    const res = await app.request('/learners/kid1/conceptual/SK-FR-equiv', json(g2));
    expect(res.status).toBe(403);
  });

  it('404s for a skill with no assessed-core conceptual policy (on-ramp or unknown)', async () => {
    const app = await setup();
    const onRamp = await app.request('/learners/kid1/conceptual/SK-FR-partition', json(g1));
    expect(onRamp.status).toBe(404);
    const unknown = await app.request('/learners/kid1/conceptual/SK-NOPE', json(g1));
    expect(unknown.status).toBe(404);
  });
});
