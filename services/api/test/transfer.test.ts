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
 * TRANSFERABLE (AT-12): a mastered skill applied correctly in a NOVEL context
 * (a transfer_check) reaches the top standing. The planner offers the transfer
 * task; a correct answer lifts the skill to TRANSFERABLE in the session summary.
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

async function seedMastered(db: PotenovaDb, skillId: string, tag: string) {
  const repo = new EvidenceRepository(db);
  const at = new Date().toISOString();
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

describe('TRANSFERABLE via transfer tasks', () => {
  it('a correct transfer answer lifts a mastered skill to TRANSFERABLE', async () => {
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

    // Both skills already mastered (recent) → the planner offers a transfer check.
    await seedMastered(db, 'SK-FR-equiv', 'eq');
    await seedMastered(db, 'SK-FR-compare', 'cmp');

    const started = await (
      await app.request(
        '/learners/kid1/sessions',
        json(child, { subject: 'math', requestedMinutes: 20 }),
      )
    ).json();
    expect(started.next.reasonCode).toBe('TRANSFER_CHECK');
    expect(started.next.defaultTaskId).toBe('frac-xfer-cmp');

    // Answer the transfer task correctly (3/4 > 2/3 → gt).
    const body = await (
      await app.request(
        `/learners/kid1/sessions/${started.session.sessionId}/answer`,
        json(child, { clientSubmissionId: 'x1', taskId: 'frac-xfer-cmp', answer: 'gt' }),
      )
    ).json();
    expect(body.correct).toBe(true);
    expect(body.skillId).toBe('SK-FR-compare');
    expect(body.projection.state).toBe('TRANSFERABLE');

    // Every coachable skill is now mastered → the session completes with a summary
    // that shows the top standing.
    expect(body.sessionComplete).toBe(true);
    const compare = body.summary.mastery.find(
      (m: { skillId: string }) => m.skillId === 'SK-FR-compare',
    );
    expect(compare.projection.state).toBe('TRANSFERABLE');
  });
});
