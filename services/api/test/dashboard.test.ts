import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';

/**
 * Parent dashboard grouped by subject: after the learner works both a Math and an
 * English skill, the guardian sees them side by side (grouped), with no explicit
 * skills list required.
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

async function workOneItem(
  app: ReturnType<typeof createApp>,
  subject: 'math' | 'english',
  taskId: string,
  answer: string,
) {
  const started = await (
    await app.request('/learners/kid1/sessions', json(child, { subject, requestedMinutes: 10 }))
  ).json();
  const sessionId = started.session.sessionId as string;
  await app.request(
    `/learners/kid1/sessions/${sessionId}/answer`,
    json(child, { clientSubmissionId: `${subject}-1`, taskId, answer }),
  );
}

describe('parent dashboard grouped by subject', () => {
  it('shows Math and English side by side without an explicit skills list', async () => {
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

    await workOneItem(app, 'math', 'frac-cmp-1', 'gt');
    await workOneItem(app, 'english', 'eng-base-1', 'dogs');

    const dash = await (await app.request('/learners/kid1/dashboard', json(owner))).json();

    expect(dash.bySubject.map((g: { subject: string }) => g.subject)).toEqual(['english', 'math']);
    const math = dash.bySubject.find((g: { subject: string }) => g.subject === 'math');
    const english = dash.bySubject.find((g: { subject: string }) => g.subject === 'english');
    expect(math.rows.map((r: { skillId: string }) => r.skillId)).toContain('SK-FR-compare');
    expect(english.rows.map((r: { skillId: string }) => r.skillId)).toContain('SK-EN-plural-base');
    // Flat view still carries both skills.
    expect(dash.rows).toHaveLength(2);

    // "Why this today?" per subject: the planner's current objective + reason.
    for (const g of [math, english]) {
      expect(g.nextFocus.skillId.length).toBeGreaterThan(0);
      expect(g.nextFocus.reasonCode.length).toBeGreaterThan(0);
      expect(g.nextFocus.explanation.length).toBeGreaterThan(0);
      // PAR-016: never exposes raw internal chain-of-thought.
      expect(g.nextFocus.exposesChainOfThought).toBe(false);
    }
  });
});
