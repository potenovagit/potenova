import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';

/**
 * Coaching ladder: an early wrong answer gets a targeted, authored HINT (from the
 * curriculum's misconception → remediation-strategy KB); a repeated wrong answer
 * escalates to the stall-driven strategy change (no hint). A skill with no
 * misconception KB yields no hint.
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

async function startMathSession() {
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
  const started = await (
    await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', requestedMinutes: 20 }),
    )
  ).json();
  return { app, sessionId: started.session.sessionId as string };
}

const answer = (
  app: Awaited<ReturnType<typeof startMathSession>>['app'],
  sessionId: string,
  body: Record<string, unknown>,
) => app.request(`/learners/kid1/sessions/${sessionId}/answer`, json(child, body));

describe('coaching hint ladder', () => {
  it('gives a targeted hint on the first wrong answer (misconception → strategy)', async () => {
    const { app, sessionId } = await startMathSession();
    // frac-cmp-1 truth is gt; 'lt' is wrong.
    const body = await (
      await answer(app, sessionId, { clientSubmissionId: 'w1', taskId: 'frac-cmp-1', answer: 'lt' })
    ).json();
    expect(body.correct).toBe(false);
    expect(body.coaching).toBeUndefined(); // not stalled yet
    expect(body.hint.level).toBe(1);
    expect(body.hint.misconceptionId).toBe('MC-FR-denom-size');
    expect(body.hint.strategyId).toBe('ST-area-model');
    expect(body.hint.message.length).toBeGreaterThan(0);
    expect(body.hint.ladder.map((h: { strategyId: string }) => h.strategyId)).toEqual([
      'ST-area-model',
      'ST-number-line',
    ]);
  });

  it('escalates to the strategy change (no hint) on a repeated wrong answer', async () => {
    const { app, sessionId } = await startMathSession();
    await answer(app, sessionId, { clientSubmissionId: 'w1', taskId: 'frac-cmp-1', answer: 'lt' });
    const second = await (
      await answer(app, sessionId, { clientSubmissionId: 'w2', taskId: 'frac-cmp-1', answer: 'lt' })
    ).json();
    expect(second.coaching.stalled).toBe(true);
    expect(second.hint).toBeUndefined();
  });

  it('gives no hint for a skill with no misconception KB', async () => {
    const { app, sessionId } = await startMathSession();
    // frac-eq-2 truth is 'no'; 'yes' is wrong — SK-FR-equiv has no misconception.
    const body = await (
      await answer(app, sessionId, { clientSubmissionId: 'e1', taskId: 'frac-eq-2', answer: 'yes' })
    ).json();
    expect(body.correct).toBe(false);
    expect(body.hint).toBeUndefined();
  });

  it('gives no hint on a correct answer', async () => {
    const { app, sessionId } = await startMathSession();
    const body = await (
      await answer(app, sessionId, { clientSubmissionId: 'c1', taskId: 'frac-cmp-1', answer: 'gt' })
    ).json();
    expect(body.correct).toBe(true);
    expect(body.hint).toBeUndefined();
  });
});
