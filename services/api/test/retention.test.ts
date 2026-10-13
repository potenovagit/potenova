import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import {
  openDatabase,
  BillingRepository,
  EvidenceRepository,
  type PotenovaDb,
} from '@potenova/persistence';
import type { MasteryEvidence } from '@potenova/learner-state';

/**
 * Retention / review-due (AT-57): a skill mastered but not practised within the
 * planner's decay window resurfaces for review before the learner advances.
 */

const env = { APP_ENV: 'staging', PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' };
const owner = {
  'x-actor-type': 'guardian',
  'x-actor-alias': 'g1',
  'x-guardian-role': 'owner',
  'x-family-alias': 'fam1',
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

const REPS = ['symbolic', 'area-model', 'number-line'];

/** Seed 3 unaided-correct across 3 representations → INDEPENDENT, at a given time. */
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

async function setupWithDecayedMastery() {
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
  await app.request(
    '/families/fam1/consent',
    json(owner, { grantId: 'cg0', purpose: 'child_learning', modality: 'text', version: 'v1' }),
  );
  await new BillingRepository(db).saveEntitlement({
    familyId: 'fam1',
    state: 'PAID_ACTIVE',
    tierId: 't1',
    updatedAt: '2026-10-13T00:00:00Z',
  });

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  // Equivalence mastered recently; comparison mastered 30 days ago (past the
  // 21-day decay window) → comparison is review-due.
  await seedMastered(db, 'SK-FR-equiv', new Date(now - DAY).toISOString(), 'eq');
  await seedMastered(db, 'SK-FR-compare', new Date(now - 30 * DAY).toISOString(), 'cmp');

  const started = await (
    await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', requestedMinutes: 20 }),
    )
  ).json();
  return { app, sessionId: started.session.sessionId as string, started };
}

describe('retention / review-due', () => {
  it('recommends REVIEW_DUE for a mastered skill past the decay window', async () => {
    const { app, sessionId, started } = await setupWithDecayedMastery();

    // Session start already recommends the review.
    expect(started.next.skillId).toBe('SK-FR-compare');
    expect(started.next.reasonCode).toBe('REVIEW_DUE');

    const next = await (
      await app.request(`/learners/kid1/sessions/${sessionId}/next`, json(child))
    ).json();
    expect(next.skillId).toBe('SK-FR-compare');
    expect(next.reasonCode).toBe('REVIEW_DUE');
  });

  it('a review attempt resolves RETAINED and the skill stops resurfacing', async () => {
    const { app, sessionId } = await setupWithDecayedMastery();

    // Re-practise the review-due skill (1/2 > 1/3 → gt). The turn is tagged as a
    // review, so the delayed correct retrieval resolves RETAINED.
    const body = await (
      await app.request(
        `/learners/kid1/sessions/${sessionId}/answer`,
        json(child, { clientSubmissionId: 'rev1', taskId: 'frac-cmp-1', answer: 'gt' }),
      )
    ).json();
    expect(body.reviewed).toBe(true);
    expect(body.correct).toBe(true);
    expect(body.projection.dimensions.retained).toBe(true);
    expect(body.projection.state).toBe('RETAINED');

    // The planner no longer flags comparison for review (just practised).
    const next = await (
      await app.request(`/learners/kid1/sessions/${sessionId}/next`, json(child))
    ).json();
    expect(next.reasonCode).not.toBe('REVIEW_DUE');
  });
});
