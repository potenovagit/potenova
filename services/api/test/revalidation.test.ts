import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import {
  openDatabase,
  BillingRepository,
  EvidenceRepository,
  type PotenovaDb,
} from '@potenova/persistence';
import type { MasteryEvidence } from '@potenova/learner-state';
import { seedMastered } from './support/seed';

/**
 * REVALIDATION_REQUIRED flow: a once-mastered skill that is contradicted must
 * resurface for re-verification before the learner advances past it — and clears
 * only once re-demonstrated with FRESH unaided evidence. Mastery stays derived;
 * the contradiction and the re-validation are both immutable evidence.
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

function ev(over: Partial<MasteryEvidence> & { eventId: string }): MasteryEvidence {
  return {
    learnerAlias: 'kid1',
    skillId: 'SK-FR-equiv',
    mode: 'independent_check',
    assistanceBand: 'A0',
    correct: true,
    representation: 'area-model',
    recognitionConfidence: 1,
    observedAt: '2026-10-01T09:00:00.000Z',
    curriculumReleaseId: 'REL-ONT-MATH-2020-draft',
    schemaVersion: 'evt-0.1',
    ...over,
  };
}

async function setup() {
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
    json(owner, { grantId: 'cg1', purpose: 'child_learning', modality: 'text', version: 'v1' }),
  );
  await new BillingRepository(db).saveEntitlement({
    familyId: 'fam1',
    state: 'PAID_ACTIVE',
    tierId: 't1',
    updatedAt: '2026-10-16T00:00:00Z',
  });
  // Seed: equivalence mastered, then contradicted (a wrong unaided check).
  const repo = new EvidenceRepository(db);
  await repo.appendEvidence(
    ev({ eventId: 's1', representation: 'area-model', observedAt: '2026-10-01T09:00:00.000Z' }),
  );
  await repo.appendEvidence(
    ev({ eventId: 's2', representation: 'number-line', observedAt: '2026-10-01T09:05:00.000Z' }),
  );
  await repo.appendEvidence(
    ev({ eventId: 's3', representation: 'symbolic', observedAt: '2026-10-01T09:10:00.000Z' }),
  );
  await repo.appendEvidence(
    ev({
      eventId: 's4',
      correct: false,
      representation: 'symbolic',
      observedAt: '2026-10-05T09:00:00.000Z',
    }),
  );
  // The other pilot fraction skills are mastered (recently, not review-due), so the
  // only skill in play is equivalence (revalidation) and, once it clears, comparison.
  for (const skillId of [
    'SK-FR-partition',
    'SK-FR-unit',
    'SK-FR-nonunit',
    'SK-FR-numberline',
    'SK-FR-order',
  ]) {
    await seedMastered(db, skillId, '2026-10-16T00:00:00.000Z', `pre-${skillId}`);
  }
  return app;
}

describe('REVALIDATION_REQUIRED flow', () => {
  it('resurfaces the contradicted skill, then clears it after fresh re-validation', async () => {
    const app = await setup();

    const start = await (
      await app.request(
        '/learners/kid1/sessions',
        json(child, { subject: 'math', requestedMinutes: 20 }),
      )
    ).json();
    const sessionId = start.session.sessionId as string;

    // The planner resurfaces equivalence for re-verification — not advancement.
    expect(start.next.skillId).toBe('SK-FR-equiv');
    expect(start.next.reasonCode).toBe('REVALIDATION_REQUIRED');

    // Re-demonstrate with fresh unaided-correct answers across representations.
    const reps = ['area-model', 'number-line', 'symbolic'];
    let last: { next?: { skillId: string; reasonCode: string } } = {};
    for (let i = 0; i < reps.length; i++) {
      last = await (
        await app.request(
          `/learners/kid1/sessions/${sessionId}/answer`,
          json(child, {
            clientSubmissionId: `rv-${i}`,
            taskId: 'frac-eq-1',
            answer: 'yes',
            representation: reps[i],
          }),
        )
      ).json();
    }

    // Cleared: the planner no longer flags equivalence for revalidation and moves on.
    expect(last.next?.reasonCode).not.toBe('REVALIDATION_REQUIRED');
    expect(last.next?.skillId).toBe('SK-FR-compare');
  });

  it('keeps resurfacing until enough fresh evidence accrues', async () => {
    const app = await setup();
    const start = await (
      await app.request(
        '/learners/kid1/sessions',
        json(child, { subject: 'math', requestedMinutes: 20 }),
      )
    ).json();
    const sessionId = start.session.sessionId as string;

    // One fresh correct answer is not enough (DRAFT bar: 3 across ≥2 reps).
    const after1 = await (
      await app.request(
        `/learners/kid1/sessions/${sessionId}/answer`,
        json(child, {
          clientSubmissionId: 'one',
          taskId: 'frac-eq-1',
          answer: 'yes',
          representation: 'area-model',
        }),
      )
    ).json();
    expect(after1.next.skillId).toBe('SK-FR-equiv');
    expect(after1.next.reasonCode).toBe('REVALIDATION_REQUIRED');
  });
});
