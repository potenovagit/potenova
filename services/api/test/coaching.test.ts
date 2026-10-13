import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';

/** Coaching turn: validated task delivery, grading → evidence → mastery, and the
 *  escalation diversion — all within an ACTIVE child session. */

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

/** Fresh app with consent + active entitlement + a started ACTIVE session. */
async function activeSession() {
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
    updatedAt: '2026-10-13T00:00:00Z',
  });
  const started = await (
    await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', requestedMinutes: 15 }),
    )
  ).json();
  return { app, sessionId: started.session.sessionId as string };
}

describe('coaching turn', () => {
  it('delivers a validated task', async () => {
    const { app, sessionId } = await activeSession();
    const res = await app.request(
      `/learners/kid1/sessions/${sessionId}/task?taskId=frac-cmp-1`,
      json(child, {}),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.taskId).toBe('frac-cmp-1');
    expect(body.options).toEqual(['lt', 'eq', 'gt']);
  });

  it('grades a correct answer into evidence and derives mastery', async () => {
    const { app, sessionId } = await activeSession();
    const res = await app.request(
      `/learners/kid1/sessions/${sessionId}/answer`,
      json(child, { clientSubmissionId: 's1', taskId: 'frac-cmp-1', answer: 'gt' }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.graded).toBe(true);
    expect(body.correct).toBe(true); // 1/2 > 1/3
    expect(body.projection).toBeDefined();
  });

  it('grades a wrong answer as incorrect', async () => {
    const { app, sessionId } = await activeSession();
    const body = await (
      await app.request(
        `/learners/kid1/sessions/${sessionId}/answer`,
        json(child, { clientSubmissionId: 's1', taskId: 'frac-cmp-1', answer: 'lt' }),
      )
    ).json();
    expect(body.correct).toBe(false);
  });

  it('a retried submission produces no second evidence event (AT-27)', async () => {
    const { app, sessionId } = await activeSession();
    await app.request(
      `/learners/kid1/sessions/${sessionId}/answer`,
      json(child, { clientSubmissionId: 'dup', taskId: 'frac-cmp-1', answer: 'gt' }),
    );
    const second = await app.request(
      `/learners/kid1/sessions/${sessionId}/answer`,
      json(child, { clientSubmissionId: 'dup', taskId: 'frac-cmp-1', answer: 'gt' }),
    );
    expect((await second.json()).duplicate).toBe(true);
  });

  it('a flagged disclosure diverts to escalation (fail-closed max containment)', async () => {
    const { app, sessionId } = await activeSession();
    const body = await (
      await app.request(
        `/learners/kid1/sessions/${sessionId}/answer`,
        json(child, {
          clientSubmissionId: 's2',
          disclosure: {
            category: 'general_distress',
            severity: 'elevated',
            confidence: 'medium',
            householdImplicated: false,
          },
        }),
      )
    ).json();
    expect(body.graded).toBe(false);
    expect(body.safety.handling).toBe('SAFETY_PROTOCOL');
    expect(body.safety.humanReview).toBe(true); // empty matrix → max containment
    expect(body.safety.reasonCodes).toContain('UNCONFIGURED_MAX_CONTAINMENT');
  });

  it('refuses a turn once the session is no longer active', async () => {
    const { app, sessionId } = await activeSession();
    await app.request(`/learners/kid1/sessions/${sessionId}/end`, json(child, {}));
    const res = await app.request(
      `/learners/kid1/sessions/${sessionId}/answer`,
      json(child, { clientSubmissionId: 's3', taskId: 'frac-cmp-1', answer: 'gt' }),
    );
    expect(res.status).toBe(422);
  });

  it('403s for a non-child actor', async () => {
    const { app, sessionId } = await activeSession();
    const res = await app.request(`/learners/kid1/sessions/${sessionId}/task`, json(owner, {}));
    expect(res.status).toBe(403);
  });
});
