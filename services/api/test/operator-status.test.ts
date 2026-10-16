import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, type PotenovaDb } from '@potenova/persistence';
import { StubGenerativeProvider } from '@potenova/ai-gateway';

/**
 * Operator / QA status view (G2). Surfaces the fail-closed policy posture, the
 * AI model-eval posture (no production-approved model), the latency SLO as an
 * unapproved DRAFT slot, and a live content-gate self-check — read-only.
 */

const env = { APP_ENV: 'staging', PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' };
const operator = { 'x-actor-type': 'operator', 'x-actor-alias': 'op1' };
const guardian = { 'x-actor-type': 'guardian', 'x-actor-alias': 'g1', 'x-family-alias': 'fam1' };

let dbs: PotenovaDb[] = [];
afterEach(async () => {
  await Promise.all(dbs.map((d) => d.close()));
  dbs = [];
});

function appWith(provider?: StubGenerativeProvider) {
  const db = openDatabase();
  dbs.push(db);
  return createApp({ env, db, aiProvider: provider });
}
const get = (headers: Record<string, string>) => ({
  method: 'GET',
  headers: { 'content-type': 'application/json', ...headers },
});

describe('GET /operator/status', () => {
  it('reports fail-closed policy states and a passing content-gate self-check', async () => {
    const app = appWith();
    const res = await app.request('/operator/status', get(operator));
    expect(res.status).toBe(200);
    const s = await res.json();

    // Every EVIDENCE-REQUIRED policy is unapproved on synthetic staging → not prod-ready.
    expect(s.policies.mastery.approved).toBe(false);
    expect(s.policies.mastery.version).toContain('DRAFT');
    expect(s.policies.usageCaps.allApproved).toBe(false);
    expect(s.policies.escalation.approved).toBe(false);
    expect(s.prodReady).toBe(false);

    // No model is approved for production, and with no provider the eval is not runnable.
    expect(s.ai.anyModelApprovedForProduction).toBe(false);
    expect(s.ai.providerConfigured).toBe(false);
    expect(s.ai.candidateModel).toBeNull();
    expect(s.modelEval.runnable).toBe(false);
    // Latency SLO is an explicit unapproved DRAFT slot — never a fabricated pass.
    expect(s.modelEval.latency.sloMs).toBeNull();
    expect(s.modelEval.latency.approved).toBe(false);

    // The content gate is live (delivers a valid item, refuses an unknown one).
    expect(s.contentGate.active).toBe(true);
    expect(s.contentGate.positive).toBe(true);
    expect(s.contentGate.negativeBlocked).toBe(true);
  });

  it('reflects a configured candidate model as SYNTHETIC_TESTING (never approved)', async () => {
    const app = appWith(new StubGenerativeProvider('{"answer":"gt"}'));
    const s = await (await app.request('/operator/status', get(operator))).json();
    expect(s.ai.providerConfigured).toBe(true);
    expect(s.ai.candidateModel.status).toBe('SYNTHETIC_TESTING');
    expect(s.ai.anyModelApprovedForProduction).toBe(false);
    expect(s.modelEval.runnable).toBe(true);
    expect(s.modelEval.envelope.subjects).toContain('math');
  });

  it('is operator-only (a guardian is forbidden)', async () => {
    const app = appWith();
    const res = await app.request('/operator/status', get(guardian));
    expect(res.status).toBe(403);
  });
});
