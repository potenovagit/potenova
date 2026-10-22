import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, type PotenovaDb } from '@potenova/persistence';
import { resolveTask } from '../src/task-bank';

/**
 * Generated-item delivery must never 404 on an exhausted pool. The generator
 * yields a finite DISTINCT pool per skill/difficulty; a diagnostic that re-probes
 * one skill more times than it has distinct items would previously overflow the
 * pool and fail to deliver the next probe ("generated item index out of range").
 * Delivery now cycles within the pool deterministically. Synthetic only.
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

// A format-valid token per skill. These are NOT always correct, so skills do not
// resolve quickly and the run re-probes them — driving the pool-exhaustion path.
const tokenFor = (skill: string): string => {
  switch (skill) {
    case 'SK-FR-compare':
      return 'gt';
    case 'SK-FR-equiv':
      return 'yes';
    case 'SK-FR-order':
      return '1,2,3';
    case 'SK-FR-numberline':
      return '1';
    default:
      return '1/2'; // partition / unit / nonunit
  }
};

describe('diagnostic generated-item coverage', () => {
  it('a run that re-probes a skill past its pool never 404s and still terminates', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    await app.request(
      '/families',
      json(owner, { familyId: 'fam1', marketRegion: 'ca-on', legalOwnerGuardianId: 'g1' }),
    );
    await app.request(
      '/families/fam1/learners',
      json(owner, { learnerId: 'kid1', nickname: 'Kid', grade: 3 }),
    );
    await app.request(
      '/families/fam1/consent',
      json(owner, { grantId: 'cg1', purpose: 'child_learning', modality: 'text', version: 'v1' }),
    );

    const startRes = await app.request(
      '/learners/kid1/diagnostic/runs',
      json(child, { subject: 'math' }),
    );
    expect(startRes.status).toBe(201);
    let resp = await startRes.json();
    const runId = resp.runId as string;

    let turns = 0;
    for (let i = 0; i < 30 && !resp.complete; i++) {
      const next = resp.next as { skillId: string; taskId: string };
      const res = await app.request(
        `/learners/kid1/diagnostic/runs/${runId}/answer`,
        json(child, {
          clientSubmissionId: `p${i}`,
          taskId: next.taskId,
          answer: tokenFor(next.skillId),
        }),
      );
      // The regression: delivering the next probe used to 404 once a skill's
      // generated pool was exhausted. Every turn must now be served.
      expect(res.status).toBe(201);
      resp = await res.json();
      turns++;
    }

    // The run reaches a terminal state (SUFFICIENT or the PARTIAL budget ceiling),
    // not an error.
    expect(resp.complete).toBe(true);
    expect(turns).toBeGreaterThan(0);
  });

  it('an index past the generated pool resolves deterministically (cycles, no throw)', () => {
    // SK-FR-unit has a small distinct core pool; a high index must still resolve,
    // and resolve to the SAME task every time (determinism from the id).
    const id = 'gen:SK-FR-unit:7:core:50';
    const a = resolveTask(id);
    const b = resolveTask(id);
    expect(a).toEqual(b);
    expect(a.skillId).toBe('SK-FR-unit');
  });
});
