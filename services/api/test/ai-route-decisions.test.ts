import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, type PotenovaDb } from '@potenova/persistence';
import {
  StubGenerativeProvider,
  type GenerativeProvider,
  type GenerativeResult,
} from '@potenova/ai-gateway';
import { DomainError } from '@potenova/contracts';

/**
 * AI-006 route-decision logging. Every routing decision is logged with the
 * model, policy, capability, cost (units) and fallback/block reason — from the
 * real eval path and from a synthetic route probe across capabilities.
 */

const env = { APP_ENV: 'staging', PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' };
const operator = {
  'x-actor-type': 'operator',
  'x-actor-alias': 'op1',
  'x-operator-role': 'read_only',
};

let dbs: PotenovaDb[] = [];
function appWith(provider?: GenerativeProvider) {
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

class AlwaysDown implements GenerativeProvider {
  readonly id = 'azure-openai:tutor-mini';
  readonly region = 'ca-central';
  async generate(): Promise<GenerativeResult> {
    throw new DomainError('DEPENDENCY_UNAVAILABLE', 'down');
  }
}

describe('route-decision logging from the eval path', () => {
  it('logs a successful eval route with model, capability and cost units', async () => {
    const { app } = appWith(
      new StubGenerativeProvider('{"answer":"gt","explanation":"1/2 > 1/3"}'),
    );
    await app.request('/operator/model-eval', post(operator));
    const { decisions } = await (
      await app.request('/operator/route-decisions', get(operator))
    ).json();
    expect(decisions).toHaveLength(1);
    expect(decisions[0].outcome).toBe('EVAL_ROUTE');
    expect(decisions[0].capability).toBe('task_generation');
    expect(decisions[0].chosenModel).toBe('stub-generator');
    expect(decisions[0].units).toBe(1);
    expect(decisions[0].reasonCode).toBeNull();
  });

  it('logs a FALLBACK route with the reason when the model fails', async () => {
    const { app } = appWith(new AlwaysDown());
    await app.request('/operator/model-eval', post(operator));
    const { decisions } = await (
      await app.request('/operator/route-decisions', get(operator))
    ).json();
    expect(decisions[0].outcome).toBe('FALLBACK');
    expect(decisions[0].reasonCode).toBe('attempts_exhausted');
    expect(decisions[0].chosenModel).toBeNull();
  });
});

describe('route probe (AI-006 task-specific routing, fail-closed pre-G2)', () => {
  it('logs a BLOCK with a reason for each capability (no approved model)', async () => {
    const { app } = appWith();
    for (const capability of ['task_generation', 'speech_to_text', 'vision_ocr']) {
      const res = await app.request(
        '/operator/route-probe',
        post(operator, { capability, ageBand: 'g4-6', subject: 'math', modelId: 'some-model' }),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.outcome).toBe('BLOCK');
      expect(body.chosenModel).toBeNull();
      expect(typeof body.reasonCode).toBe('string');
    }
    const { decisions } = await (
      await app.request('/operator/route-decisions', get(operator))
    ).json();
    expect(decisions).toHaveLength(3);
    expect(decisions.map((d: { capability: string }) => d.capability).sort()).toEqual([
      'speech_to_text',
      'task_generation',
      'vision_ocr',
    ]);
  });

  it('blocks and logs a non-Canadian processing region (residency)', async () => {
    const { app } = appWith();
    const res = await app.request(
      '/operator/route-probe',
      post(operator, {
        capability: 'task_generation',
        ageBand: 'g4-6',
        subject: 'math',
        processingRegion: 'us-east',
      }),
    );
    expect((await res.json()).reasonCode).toBe('REGION_DISALLOWED');
  });

  it('surfaces the route-decision count in operator metrics', async () => {
    const { app } = appWith();
    await app.request(
      '/operator/route-probe',
      post(operator, { capability: 'task_generation', ageBand: 'g4-6', subject: 'math' }),
    );
    const m = await (await app.request('/operator/metrics', get(operator))).json();
    expect(m.ai.routeDecisions).toBe(1);
  });
});
