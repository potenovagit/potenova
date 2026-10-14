import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, EvidenceRepository, type PotenovaDb } from '@potenova/persistence';
import type { MasteryEvidence } from '@potenova/learner-state';

/**
 * Per-skill dashboard cues: a mastered skill not practised in a while is
 * "due for review"; a mastered skill not yet shown in a novel context is
 * "ready for a challenge".
 */

const env = { APP_ENV: 'staging', PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' };
const owner = {
  'x-actor-type': 'guardian',
  'x-actor-alias': 'g1',
  'x-guardian-role': 'owner',
  'x-family-alias': 'fam1',
};

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

const REPS = ['symbolic', 'area-model', 'number-line'];

async function seedMastered(db: PotenovaDb, skillId: string, at: string, tag: string) {
  const repo = new EvidenceRepository(db);
  for (let i = 0; i < REPS.length; i++) {
    const ev: MasteryEvidence = {
      eventId: `seed-${tag}-${i}`,
      learnerAlias: 'kid1',
      skillId,
      mode: 'independent_check',
      assistanceBand: 'A0',
      correct: true,
      representation: REPS[i],
      recognitionConfidence: 1,
      observedAt: at,
      curriculumReleaseId: 'REL-ONT-MATH-2020-draft',
      schemaVersion: 'evt-0.1',
    };
    await repo.appendEvidence(ev);
  }
}

describe('dashboard per-skill cues', () => {
  it('flags review-due and transfer-ready skills', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    await app.request(
      '/families',
      json(owner, { familyId: 'fam1', marketRegion: 'ca-on', legalOwnerGuardianId: 'g1' }),
    );
    await app.request(
      '/families/fam1/learners',
      json(owner, { learnerId: 'kid1', nickname: 'Kid', grade: 5 }),
    );

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    // Equivalence mastered recently (ready for a challenge); comparison mastered
    // 30 days ago (due for review).
    await seedMastered(db, 'SK-FR-equiv', new Date(now - DAY).toISOString(), 'eq');
    await seedMastered(db, 'SK-FR-compare', new Date(now - 30 * DAY).toISOString(), 'cmp');

    const dash = await (await app.request('/learners/kid1/dashboard', json(owner))).json();
    const math = dash.bySubject.find((g: { subject: string }) => g.subject === 'math');
    const cueOf = (id: string) => math.rows.find((r: { skillId: string }) => r.skillId === id)?.cue;

    expect(cueOf('SK-FR-equiv')).toBe('TRANSFER_READY');
    expect(cueOf('SK-FR-compare')).toBe('REVIEW_DUE');
  });
});
