import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, SafetyRepository, type PotenovaDb } from '@potenova/persistence';
import {
  StubGenerativeProvider,
  type GenerativeProvider,
  type GenerativeResult,
} from '@potenova/ai-gateway';

/**
 * AI usage/cost wiring (AI-013/AI-014/AI-020). The candidate-eval path (the only
 * path that calls a real model pre-G2) now records privacy-safe usage events
 * with the provider's real token units, surfaces them to operators, and raises
 * an operator-only anomaly over the DRAFT budget — never touching a child.
 */

const env = { APP_ENV: 'staging', PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' };
const operator = {
  'x-actor-type': 'operator',
  'x-actor-alias': 'op1',
  'x-operator-role': 'read_only',
};

let dbs: PotenovaDb[] = [];
function appWith(provider: GenerativeProvider) {
  const db = openDatabase();
  dbs.push(db);
  return { app: createApp({ env, db, aiProvider: provider }), db };
}
afterEach(async () => {
  await Promise.all(dbs.map((d) => d.close()));
  dbs = [];
});

const get = (h: Record<string, string>) => ({
  method: 'GET',
  headers: { 'content-type': 'application/json', ...h },
});
const post = (h: Record<string, string>, body: unknown = {}) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...h },
  body: JSON.stringify(body),
});

/** A candidate provider reporting a chosen token count (and a valid math answer). */
class UnitsProvider implements GenerativeProvider {
  readonly id = 'azure-openai:tutor-mini';
  readonly region = 'ca-central';
  constructor(private readonly units: number) {}
  async generate(): Promise<GenerativeResult> {
    return { text: '{"answer":"gt","explanation":"1/2 > 1/3"}', model: this.id, units: this.units };
  }
}

describe('AI usage/cost accounting from the eval path', () => {
  it('records a usage event with the provider token units and surfaces it to operators', async () => {
    const { app } = appWith(
      new StubGenerativeProvider('{"answer":"gt","explanation":"1/2 > 1/3"}'),
    );

    const evalRes = await app.request('/operator/model-eval', post(operator));
    expect(evalRes.status).toBe(200);
    const body = await evalRes.json();
    expect(body.deliveredToChild).toBe(false);
    expect(typeof body.estimatedCost).toBe('number');

    const usage = await (await app.request('/operator/ai-usage', get(operator))).json();
    expect(usage.summary.events).toBe(1);
    expect(usage.summary.totalUnits).toBeGreaterThanOrEqual(1);
    expect(usage.byModel.map((m: { key: string }) => m.key)).toContain('stub-generator');

    const m = await (await app.request('/operator/metrics', get(operator))).json();
    expect(m.ai.usage.events).toBe(1);
    expect(m.ai.usage.totalUnits).toBe(usage.summary.totalUnits);
    expect(m.ai.usage.estimatedCostDraft).toBeGreaterThan(0);
  });

  it('accumulates usage across single + suite runs', async () => {
    const { app } = appWith(
      new StubGenerativeProvider('{"answer":"gt","explanation":"1/2 > 1/3"}'),
    );
    await app.request('/operator/model-eval', post(operator));
    await app.request('/operator/model-eval/suite', post(operator));
    const usage = await (await app.request('/operator/ai-usage', get(operator))).json();
    expect(usage.summary.events).toBe(2);
    expect(usage.byCapability.map((r: { key: string }) => r.key)).toContain('task_generation');
  });

  it('raises an operator-only cost anomaly over the DRAFT budget — no child effect', async () => {
    // 20000 units * DRAFT_UNIT_COST(0.0001) = 2.0 > DRAFT_SESSION_COST_BUDGET(1.0).
    const { app, db } = appWith(new UnitsProvider(20000));
    const res = await app.request('/operator/model-eval', post(operator));
    expect(res.status).toBe(200);
    expect((await res.json()).deliveredToChild).toBe(false);

    const audit = await new SafetyRepository(db).recentAudit();
    const anomaly = audit.find((a) => a.action === 'ai_cost_anomaly');
    expect(anomaly?.outcome).toBe('ALERT');
    expect(anomaly?.object).toContain('azure-openai:tutor-mini');
  });

  it('does not raise an anomaly for normal usage', async () => {
    const { app, db } = appWith(new UnitsProvider(10)); // 10 * 0.0001 = 0.001, under budget
    await app.request('/operator/model-eval', post(operator));
    const audit = await new SafetyRepository(db).recentAudit();
    expect(audit.find((a) => a.action === 'ai_cost_anomaly')).toBeUndefined();
  });
});
