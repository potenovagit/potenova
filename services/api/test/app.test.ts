import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, type PotenovaDb } from '@potenova/persistence';

const env = { APP_ENV: 'dev', PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' };

let dbs: PotenovaDb[] = [];
function freshApp() {
  const db = openDatabase(); // in-memory, shared across this app's requests
  dbs.push(db);
  return createApp({ env, db });
}
afterEach(async () => {
  await Promise.all(dbs.map((d) => d.close()));
  dbs = [];
});

const owner = {
  'x-actor-type': 'guardian',
  'x-actor-alias': 'g1',
  'x-guardian-role': 'owner',
  'x-family-alias': 'fam1',
};
const producer = {
  'x-actor-type': 'evidence_producer',
  'x-actor-alias': 'ep1',
  'x-family-alias': 'fam1',
};
const operator = {
  'x-actor-type': 'operator',
  'x-actor-alias': 'op1',
  'x-operator-role': 'read_only',
};

const json = (headers: Record<string, string>, body?: unknown) => ({
  method: body === undefined ? 'GET' : 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

const evidenceBody = (eventId: string) => ({
  eventId,
  mode: 'independent_check',
  assistanceBand: 'A0',
  correct: true,
  representation: 'area-model',
  recognitionConfidence: 1,
  observedAt: '2026-10-10T00:00:00Z',
  curriculumReleaseId: 'REL-ONT-MATH-2020-draft',
  schemaVersion: 'evt-0.1',
});

async function onboard(app: ReturnType<typeof createApp>) {
  await app.request(
    '/families',
    json(owner, { familyId: 'fam1', marketRegion: 'ca-on', legalOwnerGuardianId: 'g1' }),
  );
  await app.request(
    '/families/fam1/consent',
    json(owner, { grantId: 'cg1', purpose: 'child_learning', modality: 'text', version: 'v1' }),
  );
}

describe('Potenova API (Stage 2 Step 2)', () => {
  it('serves health and readiness, declaring 14 modules', async () => {
    const app = freshApp();
    expect((await app.request('/healthz')).status).toBe(200);
    const ready = await (await app.request('/readyz')).json();
    expect(ready.modules).toBe(14);
  });

  it('also serves the API under /api (single-origin production path)', async () => {
    const app = freshApp();
    // The dev proxy strips /api; the single-origin build calls /api/* directly.
    expect((await app.request('/api/healthz')).status).toBe(200);
    const ready = await (await app.request('/api/readyz')).json();
    expect(ready.modules).toBe(14);
    // An authed API route works under the prefix too.
    const op = await app.request('/api/operator/status', json(operator));
    expect(op.status).toBe(200);
    // Auth still enforced under the prefix.
    const noauth = await app.request('/api/families', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(noauth.status).toBe(401);
  });

  it('requires an actor identity (401 without auth headers)', async () => {
    const app = freshApp();
    const r = await app.request('/families', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(r.status).toBe(401);
  });

  it('role-gates mutations: a child cannot create a family', async () => {
    const app = freshApp();
    const r = await app.request(
      '/families',
      json(
        { 'x-actor-type': 'child', 'x-actor-alias': 'ch1' },
        { familyId: 'f', marketRegion: 'ca-on', legalOwnerGuardianId: 'g' },
      ),
    );
    expect(r.status).toBe(403);
  });

  it('consent fence: evidence is refused until a child_learning grant exists (AT-01)', async () => {
    const app = freshApp();
    await app.request(
      '/families',
      json(owner, { familyId: 'fam1', marketRegion: 'ca-on', legalOwnerGuardianId: 'g1' }),
    );
    const blocked = await app.request(
      '/learners/lnr1/skills/SK-FR-compare/evidence',
      json(producer, evidenceBody('e1')),
    );
    expect(blocked.status).toBe(403);
    expect((await blocked.json()).code).toBe('CONSENT_REQUIRED');

    await app.request(
      '/families/fam1/consent',
      json(owner, { grantId: 'cg1', purpose: 'child_learning', modality: 'text', version: 'v1' }),
    );
    const ok = await app.request(
      '/learners/lnr1/skills/SK-FR-compare/evidence',
      json(producer, evidenceBody('e1')),
    );
    expect(ok.status).toBe(202);

    const proj = await (
      await app.request('/learners/lnr1/skills/SK-FR-compare/projection', json(producer))
    ).json();
    expect(proj.projection.evidenceCount).toBe(1);
  });

  it('evidence ingest is producer-only — a guardian cannot write observations', async () => {
    const app = freshApp();
    await onboard(app);
    const r = await app.request(
      '/learners/lnr1/skills/SK-FR-compare/evidence',
      json(owner, evidenceBody('e1')),
    );
    expect(r.status).toBe(403);
  });

  it('residency: a non-Canadian processing region is refused (AT-55)', async () => {
    const app = freshApp();
    await onboard(app);
    const r = await app.request(
      '/learners/lnr1/skills/SK-FR-compare/evidence',
      json({ ...producer, 'x-processing-region': 'us-east-1' }, evidenceBody('e1')),
    );
    expect(r.status).toBe(451);
  });

  it('content gate: unvalidated content is blocked; a signed PASS is delivered', async () => {
    const app = freshApp();
    const blocked = await (
      await app.request(
        '/content/deliver',
        json(producer, {
          candidate: { candidateId: 'c1', verdict: 'FAIL', validationRecordRef: null },
          fallback: null,
        }),
      )
    ).json();
    expect(blocked.outcome.kind).toBe('BLOCK');
    const delivered = await (
      await app.request(
        '/content/deliver',
        json(producer, {
          candidate: {
            candidateId: 'c1',
            verdict: 'PASS',
            validationRecordRef: 'vr:val@1:c1:PASS',
          },
        }),
      )
    ).json();
    expect(delivered.outcome.kind).toBe('DELIVER');
  });

  it('billing callbacks are idempotent (no double grant) and set the entitlement', async () => {
    const app = freshApp();
    const billing = { 'x-actor-type': 'billing_service', 'x-actor-alias': 'bill1' };
    const first = await (
      await app.request(
        '/billing/callbacks',
        json(billing, { channel: 'apple', transactionId: 't1', familyId: 'fam1', kind: 'grant' }),
      )
    ).json();
    expect(first).toEqual({ applied: true, duplicate: false });
    const second = await (
      await app.request(
        '/billing/callbacks',
        json(billing, { channel: 'apple', transactionId: 't1', familyId: 'fam1', kind: 'grant' }),
      )
    ).json();
    expect(second).toEqual({ applied: false, duplicate: true });
    const ent = await (await app.request('/families/fam1/entitlement', json(billing))).json();
    expect(ent.entitlement.state).toBe('PAID_ACTIVE');
  });

  it('operator kill switch persists and reads back disabled (SAFE-012)', async () => {
    const app = freshApp();
    await app.request(
      '/operator/kill-switch',
      json(operator, { capability: 'free_form_tutor', disabled: true, reason: 'jailbreak spike' }),
    );
    const status = await (
      await app.request('/operator/kill-switch/free_form_tutor', json(operator))
    ).json();
    expect(status.active).toBe(false);
  });
});
