import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';
import { seedMastered } from './support/seed';

/**
 * Diagnostic → placement: a learner who demonstrates the prerequisite in the
 * diagnostic is PLACED past it (confidence-limited) instead of being re-taught
 * from the root. Placement is derived from immutable `mode:'diagnostic'`
 * evidence by the mastery authority — never hand-set.
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

async function onboard(withEntitlement = true) {
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
  if (withEntitlement) {
    await new BillingRepository(db).saveEntitlement({
      familyId: 'fam1',
      state: 'PAID_ACTIVE',
      tierId: 't1',
      updatedAt: '2026-10-16T00:00:00Z',
    });
  }
  return app;
}

// A diagnostic that demonstrates equivalence: 3 unaided-correct across 3
// representations (the same validated item, worked three ways).
const demonstrateEquiv = (runId: string) =>
  json(child, {
    runId,
    probes: [
      {
        clientSubmissionId: `${runId}-0`,
        taskId: 'frac-eq-1',
        answer: 'yes',
        representation: 'symbolic',
      },
      {
        clientSubmissionId: `${runId}-1`,
        taskId: 'frac-eq-1',
        answer: 'yes',
        representation: 'area-model',
      },
      {
        clientSubmissionId: `${runId}-2`,
        taskId: 'frac-eq-1',
        answer: 'yes',
        representation: 'number-line',
      },
    ],
  });

describe('diagnostic → placement', () => {
  it('places the learner past a prerequisite demonstrated in the diagnostic', async () => {
    const app = await onboard();
    // Comparison's other prerequisites (below equivalence) are already mastered, so
    // demonstrating equivalence in the diagnostic leaves comparison as the entry.
    const db = dbs[dbs.length - 1]!;
    for (const skillId of [
      'SK-FR-partition',
      'SK-FR-unit',
      'SK-FR-nonunit',
      'SK-FR-numberline',
      'SK-FR-order',
    ]) {
      await seedMastered(db, skillId, '2026-10-16T00:00:00Z', `pre-${skillId}`);
    }

    const probeRes = await app.request(
      '/learners/kid1/diagnostic/probes',
      demonstrateEquiv('run1'),
    );
    expect(probeRes.status).toBe(201);
    const probe = await probeRes.json();
    expect(probe.results.every((r: { correct: boolean }) => r.correct)).toBe(true);

    // Placement view: equivalence is demonstrated; the plan leads with comparison.
    const placeRes = await app.request('/learners/kid1/placement?subject=math', json(owner));
    expect(placeRes.status).toBe(200);
    const place = await placeRes.json();
    const equiv = place.profile.skills.find(
      (s: { skillId: string }) => s.skillId === 'SK-FR-equiv',
    );
    expect(equiv.standing).toBe('demonstrated');
    expect(place.plan.items[0].skillId).toBe('SK-FR-compare');
    // The entry objective skips re-teaching the prerequisite.
    expect(place.entry.skillId).toBe('SK-FR-compare');
    expect(place.entry.reasonCode).not.toBe('PREREQUISITE_REMEDIATION');

    // And a real session opens on comparison — not equivalence remediation.
    const start = await (
      await app.request(
        '/learners/kid1/sessions',
        json(child, { subject: 'math', requestedMinutes: 20 }),
      )
    ).json();
    expect(start.next.skillId).toBe('SK-FR-compare');
    expect(start.next.reasonCode).not.toBe('PREREQUISITE_REMEDIATION');
  });

  it('without a diagnostic, a fresh learner still enters at the prerequisite', async () => {
    const app = await onboard();
    const start = await (
      await app.request(
        '/learners/kid1/sessions',
        json(child, { subject: 'math', requestedMinutes: 20 }),
      )
    ).json();
    // Unchanged baseline behaviour: remediate the prerequisite first.
    expect(start.next.skillId).toBe('SK-FR-equiv');
    expect(start.next.reasonCode).toBe('PREREQUISITE_REMEDIATION');
  });

  it('oracle-grades probes (a wrong answer is recorded as incorrect, not trusted)', async () => {
    const app = await onboard();
    // frac-eq-2 is 1/2 vs 1/3 → NOT equivalent; claiming 'yes' must grade wrong.
    const res = await app.request(
      '/learners/kid1/diagnostic/probes',
      json(child, {
        runId: 'run2',
        probes: [{ clientSubmissionId: 'p0', taskId: 'frac-eq-2', answer: 'yes' }],
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.results[0].correct).toBe(false);
  });

  it('fails closed without consent', async () => {
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
    // No consent granted.
    const res = await app.request('/learners/kid1/diagnostic/probes', demonstrateEquiv('run3'));
    expect(res.status).toBe(403);
  });
});
