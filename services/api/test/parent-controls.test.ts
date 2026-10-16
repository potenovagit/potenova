import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';

/**
 * Guardian controls (PAR): a subject→strand focus and tightened usage caps. Both
 * only CONSTRAIN — a cap may lower the safety ceiling but never raise it, and a
 * focus picks the strand without ever skipping a prerequisite.
 */

const env = { APP_ENV: 'staging', PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' };
const owner = {
  'x-actor-type': 'guardian',
  'x-actor-alias': 'g1',
  'x-guardian-role': 'owner',
  'x-family-alias': 'fam1',
};
const otherGuardian = {
  'x-actor-type': 'guardian',
  'x-actor-alias': 'g9',
  'x-guardian-role': 'owner',
  'x-family-alias': 'fam9',
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
const put = (headers: Record<string, string>, body: unknown) => ({
  method: 'PUT',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

async function onboard() {
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
  return app;
}

describe('guardian controls', () => {
  it('a strand focus pins the session course without an explicit strand', async () => {
    const app = await onboard();

    // Default math session runs fractions (the subject default).
    const beforeStart = await (
      await app.request(
        '/learners/kid1/sessions',
        json(child, { subject: 'math', requestedMinutes: 20 }),
      )
    ).json();
    expect(beforeStart.next.skillId).toBe('SK-FR-equiv');

    // Guardian focuses Math on the addition strand.
    const set = await app.request(
      '/learners/kid1/preferences',
      put(owner, { focus: { subject: 'math', strand: 'addition' } }),
    );
    expect(set.status).toBe(200);

    // Now a math session with NO explicit strand runs addition.
    const afterStart = await (
      await app.request(
        '/learners/kid1/sessions',
        json(child, { subject: 'math', requestedMinutes: 20 }),
      )
    ).json();
    expect(afterStart.next.skillId).toBe('SK-NS-add-within10');
    expect(afterStart.strand).toBe('addition');

    // An explicit strand in the request still wins over the focus.
    const explicit = await (
      await app.request(
        '/learners/kid1/sessions',
        json(child, { subject: 'math', strand: 'fractions', requestedMinutes: 20 }),
      )
    ).json();
    expect(explicit.next.skillId).toBe('SK-FR-equiv');
  });

  it('a tightened cap shortens the allotted session time (never loosens)', async () => {
    const app = await onboard();
    // junior (grade 5) safety continuous cap is 30; the parent tightens to 10.
    await app.request(
      '/learners/kid1/preferences',
      put(owner, { caps: { maxContinuousMinutes: 10 } }),
    );
    const start = await (
      await app.request(
        '/learners/kid1/sessions',
        json(child, { subject: 'math', requestedMinutes: 20 }),
      )
    ).json();
    expect(start.allowedMinutes).toBe(10);
    expect(start.usage.kind).toBe('SHORTEN');
    expect(start.usage.reasonCodes).toContain('PARENT_LIMIT_APPLIED');
  });

  it('GET returns the stored preference; PUT validates the strand', async () => {
    const app = await onboard();
    await app.request(
      '/learners/kid1/preferences',
      put(owner, {
        focus: { subject: 'english', strand: 'plurals' },
        caps: { maxDailyMinutes: 30 },
      }),
    );
    const got = await (await app.request('/learners/kid1/preferences', json(owner))).json();
    expect(got.preference.focusSubject).toBe('english');
    expect(got.preference.focusStrand).toBe('plurals');
    expect(got.preference.maxDailyMinutes).toBe(30);

    // An invalid strand for the subject is rejected.
    const bad = await app.request(
      '/learners/kid1/preferences',
      put(owner, { focus: { subject: 'math', strand: 'plurals' } }),
    );
    expect(bad.status).toBe(422);
  });

  it('is tenant-isolated — another family guardian cannot read or set', async () => {
    const app = await onboard();
    await app.request(
      '/families',
      json(otherGuardian, { familyId: 'fam9', marketRegion: 'ca-on', legalOwnerGuardianId: 'g9' }),
    );
    const read = await app.request('/learners/kid1/preferences', json(otherGuardian));
    expect(read.status).toBe(403);
    const write = await app.request(
      '/learners/kid1/preferences',
      put(otherGuardian, { focus: { subject: 'math', strand: 'addition' } }),
    );
    expect(write.status).toBe(403);
  });
});
