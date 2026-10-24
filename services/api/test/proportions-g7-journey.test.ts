import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';

/**
 * Proportional-reasoning journey (Ontario G7 B2.10): solve a/b = c/x for the
 * missing term, graded by the deterministic cross-multiplication oracle (no
 * model). Fails closed on non-whole-number solutions. Synthetic only.
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

async function seedPaidFamily(app: ReturnType<typeof createApp>, db: PotenovaDb) {
  await app.request(
    '/families',
    json(owner, { familyId: 'fam1', marketRegion: 'ca-on', legalOwnerGuardianId: 'g1' }),
  );
  await app.request(
    '/families/fam1/learners',
    json(owner, { learnerId: 'kid1', nickname: 'Kid', grade: 7 }),
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
}

describe('proportional-reasoning journey (G7 B2.10)', () => {
  it('coaches SK-NS-proportion-solve and grades the missing term', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    await seedPaidFamily(app, db);

    const startRes = await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', strand: 'proportions-g7', requestedMinutes: 20 }),
    );
    expect(startRes.status).toBe(201);
    const start = await startRes.json();
    expect(start.next.skillId).toBe('SK-NS-proportion-solve');

    const sessionId = start.session.sessionId as string;
    const taskId = start.next.defaultTaskId as string; // prop-1: 2/3 = 4/x → x = 6
    for (let i = 0; i < 3; i++) {
      const res = await app.request(
        `/learners/kid1/sessions/${sessionId}/answer`,
        json(child, {
          clientSubmissionId: `prop-${i}`,
          taskId,
          answer: '6',
          representation: 'symbolic',
        }),
      );
      expect(res.status).toBe(201);
      expect((await res.json()).correct).toBe(true);
    }
  });

  it('grades the additive-reasoning error wrong (2/3 = 4/x is not x = 5, no model)', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    await seedPaidFamily(app, db);

    const startRes = await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', strand: 'proportions-g7', requestedMinutes: 20 }),
    );
    const start = await startRes.json();
    const sessionId = start.session.sessionId as string;

    const res = await app.request(
      `/learners/kid1/sessions/${sessionId}/answer`,
      json(child, {
        clientSubmissionId: 'prop-wrong',
        taskId: start.next.defaultTaskId,
        answer: '5', // added 1 (4 is 2 more than 2, so 3+2) instead of scaling
        representation: 'symbolic',
      }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).correct).toBe(false);
  });
});
