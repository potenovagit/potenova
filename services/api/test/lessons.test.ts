import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, type PotenovaDb } from '@potenova/persistence';

/**
 * "Learn it" delivery: authored, approved lessons selected to the child's
 * just-shown misconception. Selection-only personalisation — consent-fenced,
 * child-actor, and never serving anything unapproved.
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

async function onboard(withConsent = true) {
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
  if (withConsent) {
    await app.request(
      '/families/fam1/consent',
      json(owner, { grantId: 'cg1', purpose: 'child_learning', modality: 'text', version: 'v1' }),
    );
  }
  return app;
}

describe('learn-it lesson delivery', () => {
  it('serves the misconception-specific lesson when asked for it', async () => {
    const app = await onboard();
    const res = await app.request(
      '/learners/kid1/lessons/SK-FR-compare?misconception=MC-FR-denom-size&representation=area-model',
      json(child),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lesson.lessonId).toBe('LS-FR-compare-denom-bars');
    expect(body.lesson.approved).toBe(true);
    expect(body.lesson.approvalRef).toBeTruthy();
  });

  it('derives the misconception server-side and serves the specific lesson with no query params', async () => {
    const app = await onboard();
    const body = await (
      await app.request('/learners/kid1/lessons/SK-FR-compare', json(child))
    ).json();
    // No client params: the server resolves MC-FR-denom-size from the KB and the
    // representation from (empty) evidence, so the specific lesson is chosen.
    expect(body.lesson.lessonId).toBe('LS-FR-compare-denom-bars');
    expect(body.selection.misconceptionId).toBe('MC-FR-denom-size');
    expect(body.selection.representation).toBe('area-model');
  });

  it('ignores an invalid client-passed misconception and still serves from the KB', async () => {
    const app = await onboard();
    const body = await (
      await app.request(
        '/learners/kid1/lessons/SK-FR-compare?misconception=MC-XX-bogus',
        json(child),
      )
    ).json();
    expect(body.selection.misconceptionId).toBe('MC-FR-denom-size');
    expect(body.lesson.lessonId).toBe('LS-FR-compare-denom-bars');
  });

  it('returns null lesson for a skill with no library entry', async () => {
    const app = await onboard();
    const body = await (await app.request('/learners/kid1/lessons/SK-UNKNOWN', json(child))).json();
    expect(body.lesson).toBeNull();
  });

  it('is consent-fenced — no delivery before consent', async () => {
    const app = await onboard(false);
    const res = await app.request('/learners/kid1/lessons/SK-FR-compare', json(child));
    expect(res.status).toBe(403);
  });
});
