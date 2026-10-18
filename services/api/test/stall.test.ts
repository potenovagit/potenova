import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';
import { seedMastered } from './support/seed';

/**
 * Stall handling (AT-08): after stallAttempts (DRAFT = 2) consecutive wrong
 * answers on a skill, the strategy MUST change — the engine drops to a weak
 * coachable prerequisite, or switches to a concrete representation — never just
 * re-serves the same task.
 *
 * The fractions course now coaches all seven pilot skills, so `unit` and `nonunit`
 * are seeded mastered: comparison then drops to its remaining open prerequisite
 * (equivalence), and equivalence — whose own prerequisites are satisfied — has no
 * prerequisite to drop to and must switch representation instead.
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

async function startSession() {
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
  // Unit and non-unit fractions already mastered (see file header).
  await seedMastered(db, 'SK-FR-unit', '2026-10-13T00:00:00Z', 'unit');
  await seedMastered(db, 'SK-FR-nonunit', '2026-10-13T00:00:00Z', 'nonunit');
  const started = await (
    await app.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', requestedMinutes: 20 }),
    )
  ).json();
  return { app, sessionId: started.session.sessionId as string };
}

const answer = (
  app: Awaited<ReturnType<typeof startSession>>['app'],
  sessionId: string,
  body: Record<string, unknown>,
) => app.request(`/learners/kid1/sessions/${sessionId}/answer`, json(child, body));

describe('stall handling', () => {
  it('drops to the prerequisite after repeated wrong answers on a dependent skill', async () => {
    const { app, sessionId } = await startSession();
    // frac-cmp-1 is 1/2 vs 1/3 (truth gt); answering 'lt' is wrong.
    const first = await (
      await answer(app, sessionId, { clientSubmissionId: 'c1', taskId: 'frac-cmp-1', answer: 'lt' })
    ).json();
    expect(first.correct).toBe(false);
    expect(first.coaching).toBeUndefined(); // one wrong is not a stall yet

    const second = await (
      await answer(app, sessionId, { clientSubmissionId: 'c2', taskId: 'frac-cmp-1', answer: 'lt' })
    ).json();
    expect(second.correct).toBe(false);
    expect(second.coaching.stalled).toBe(true);
    expect(second.coaching.consecutiveWrong).toBe(2);
    expect(second.coaching.strategy).toBe('REMEDIATE_PREREQUISITE');
    expect(second.coaching.suggestedSkillId).toBe('SK-FR-equiv');
    expect(second.coaching.suggestedTaskId).toBe('frac-eq-1');
  });

  it('switches representation when there is no coachable prerequisite to drop to', async () => {
    const { app, sessionId } = await startSession();
    // frac-eq-2 is 1/2 vs 1/3 (not equivalent, truth 'no'); answering 'yes' is wrong.
    // SK-FR-equiv has no coachable prerequisite, so the strategy is a rep switch.
    await answer(app, sessionId, { clientSubmissionId: 'e1', taskId: 'frac-eq-2', answer: 'yes' });
    const second = await (
      await answer(app, sessionId, { clientSubmissionId: 'e2', taskId: 'frac-eq-2', answer: 'yes' })
    ).json();
    expect(second.coaching.stalled).toBe(true);
    expect(second.coaching.strategy).toBe('SWITCH_REPRESENTATION');
    // Both attempts defaulted to 'symbolic', so a concrete model is suggested.
    expect(second.coaching.suggestedRepresentation).toBe('area-model');
  });

  it('a correct answer resets the run — no stall coaching', async () => {
    const { app, sessionId } = await startSession();
    await answer(app, sessionId, { clientSubmissionId: 'c1', taskId: 'frac-cmp-1', answer: 'lt' });
    const recovered = await (
      await answer(app, sessionId, { clientSubmissionId: 'c2', taskId: 'frac-cmp-1', answer: 'gt' })
    ).json();
    expect(recovered.correct).toBe(true);
    expect(recovered.coaching).toBeUndefined();
  });
});
