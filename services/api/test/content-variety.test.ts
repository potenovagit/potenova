import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';

/**
 * Richer content per skill: repeat coaching of the same skill within a session
 * serves DIFFERENT practice items (rotating through the skill's pool) instead of
 * the same problem every time. Rotation is presentational only — mastery stays
 * representation-driven, so answering correctly in a single representation never
 * reaches independence and the planner keeps coaching the skill.
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
    json(owner, { learnerId: 'kid1', nickname: 'Kid', grade: 2 }),
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
  return app;
}

describe('richer content per skill (item rotation)', () => {
  it('serves distinct practice items on repeat coaching of the same skill', async () => {
    const app = await setup();
    const start = await (
      await app.request(
        '/learners/kid1/sessions',
        json(child, { subject: 'math', strand: 'addition', requestedMinutes: 30 }),
      )
    ).json();
    const sessionId = start.session.sessionId as string;

    const served: string[] = [];
    let rec = start.next as { skillId: string; defaultTaskId: string } | null;

    // Four correct answers, all in ONE representation → never independent, so the
    // planner keeps coaching within-10 and the item rotates each turn.
    for (let i = 0; i < 4; i++) {
      expect(rec).toBeTruthy();
      const { skillId, defaultTaskId: taskId } = rec!;
      expect(skillId).toBe('SK-NS-add-within10');
      served.push(taskId);

      // Each served item is a real, gate-validated task.
      const taskRes = await app.request(
        `/learners/kid1/sessions/${sessionId}/task?taskId=${taskId}`,
        json(child, {}),
      );
      expect(taskRes.status).toBe(200);
      const { question } = await taskRes.json();
      const m = /What is (\d+) \+ (\d+)\?/.exec(question);
      expect(m).toBeTruthy();
      const sum = String(Number(m![1]) + Number(m![2]));

      const res = await app.request(
        `/learners/kid1/sessions/${sessionId}/answer`,
        json(child, {
          clientSubmissionId: `v-${i}`,
          taskId,
          answer: sum,
          representation: 'counters', // single representation on purpose
        }),
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.correct).toBe(true);
      expect(body.projection.dimensions.independent).toBe(false);
      expect(body.sessionComplete).toBeFalsy();
      rec = body.next;
    }

    // The four turns used the four DISTINCT pool items in order — not one item ×4.
    expect(served).toEqual(['add-10-1', 'add-10-2', 'add-10-3', 'add-10-4']);
    expect(new Set(served).size).toBe(4);
  });

  it('GET /next does not advance the rotation (only a graded attempt does)', async () => {
    const app = await setup();
    const start = await (
      await app.request(
        '/learners/kid1/sessions',
        json(child, { subject: 'math', strand: 'addition', requestedMinutes: 30 }),
      )
    ).json();
    const sessionId = start.session.sessionId as string;

    const a = await (
      await app.request(`/learners/kid1/sessions/${sessionId}/next`, json(child))
    ).json();
    const b = await (
      await app.request(`/learners/kid1/sessions/${sessionId}/next`, json(child))
    ).json();
    // No attempt recorded between the two reads → same item both times.
    expect(a.defaultTaskId).toBe('add-10-1');
    expect(b.defaultTaskId).toBe('add-10-1');
  });
});
