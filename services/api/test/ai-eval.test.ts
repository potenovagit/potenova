import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { openDatabase, type PotenovaDb } from '@potenova/persistence';
import { StubGenerativeProvider } from '@potenova/ai-gateway';

/**
 * The operator model-eval route (AI-003). A stub generative provider stands in
 * for the real Azure OpenAI deployment so the test is fully offline. It proves
 * the route runs the candidate behind the gateway on synthetic data, validates
 * with the independent oracle, never delivers to a child, and fails closed on
 * role, region and a missing provider.
 */

const env = { APP_ENV: 'dev', PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' };
const operator = { 'x-actor-type': 'operator', 'x-actor-alias': 'op1' };

let dbs: PotenovaDb[] = [];
function appWith(provider?: StubGenerativeProvider) {
  const db = openDatabase();
  dbs.push(db);
  return createApp({ env, db, aiProvider: provider });
}
afterEach(async () => {
  await Promise.all(dbs.map((d) => d.close()));
  dbs = [];
});

const post = (headers: Record<string, string>, body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

describe('POST /operator/model-eval', () => {
  it('scores a correct model answer as PASS/DELIVER and never delivers to a child', async () => {
    const app = appWith(new StubGenerativeProvider('{"answer":"gt","explanation":"1/2 > 1/3"}'));
    const res = await app.request('/operator/model-eval', post(operator, {}));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.synthetic).toBe(true);
    expect(body.deliveredToChild).toBe(false);
    expect(body.groundTruth).toBe('gt');
    expect(body.verdict).toBe('PASS');
    expect(body.delivery).toBe('DELIVER');
    expect(body.model).toBe('stub-generator');
    expect(body.processingRegion).toBe('ca-east');
  });

  it('scores a wrong model answer as FAIL/BLOCK', async () => {
    const app = appWith(new StubGenerativeProvider('{"answer":"lt","explanation":"nope"}'));
    const res = await app.request('/operator/model-eval', post(operator, {}));
    const body = await res.json();
    expect(body.verdict).toBe('FAIL');
    expect(body.delivery).toBe('BLOCK');
  });

  it('503s when no AI provider is configured', async () => {
    const app = appWith();
    const res = await app.request('/operator/model-eval', post(operator, {}));
    expect(res.status).toBe(503);
  });

  it('403s for a non-operator actor', async () => {
    const app = appWith(new StubGenerativeProvider('{"answer":"gt"}'));
    const res = await app.request(
      '/operator/model-eval',
      post({ 'x-actor-type': 'guardian', 'x-actor-alias': 'g1' }, {}),
    );
    expect(res.status).toBe(403);
  });

  it('451s when the operator is outside the Canadian region allowlist', async () => {
    const app = appWith(new StubGenerativeProvider('{"answer":"gt"}'));
    const res = await app.request(
      '/operator/model-eval',
      post({ ...operator, 'x-processing-region': 'us-east' }, {}),
    );
    expect(res.status).toBe(451);
  });
});
