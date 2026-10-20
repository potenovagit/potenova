import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  StubGenerativeProvider,
  AzureOpenAiChatProvider,
  SelfHostedChatProvider,
} from '../src/generation';

/**
 * The generative-provider seam. The stub is deterministic and offline; the Azure
 * adapter is constructed but never called over the network here (its id, region
 * and endpoint normalisation are what the gateway and residency checks rely on).
 */

describe('StubGenerativeProvider', () => {
  it('returns its scripted text and a default identity', async () => {
    const p = new StubGenerativeProvider('{"answer":"gt"}');
    expect(p.id).toBe('stub-generator');
    expect(p.region).toBe('ca-east');
    const r = await p.generate({ prompt: 'anything' });
    expect(r.text).toBe('{"answer":"gt"}');
    expect(r.model).toBe('stub-generator');
  });

  it('honours an overridden id and region', () => {
    const p = new StubGenerativeProvider('x', { id: 'cand-1', region: 'ca-central' });
    expect(p.id).toBe('cand-1');
    expect(p.region).toBe('ca-central');
  });
});

describe('AzureOpenAiChatProvider', () => {
  it('derives an id from the deployment and carries its Canadian region', () => {
    const p = new AzureOpenAiChatProvider({
      endpoint: 'https://oai-potenova-digitery.openai.azure.com/',
      deployment: 'tutor-mini',
      apiKey: 'k',
      region: 'ca-east',
    });
    expect(p.id).toBe('azure-openai:tutor-mini');
    expect(p.region).toBe('ca-east');
  });
});

describe('SelfHostedChatProvider', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('derives an id from the model and carries its Canadian region', () => {
    const p = new SelfHostedChatProvider({
      endpoint: 'https://infer.potenova.ca/',
      model: 'llama-3.1-8b-instruct',
      region: 'ca-central',
    });
    expect(p.id).toBe('self-hosted:llama-3.1-8b-instruct');
    expect(p.region).toBe('ca-central');
  });

  it('calls the OpenAI-compatible endpoint and parses content + token units', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"answer":"gt"}' } }],
        usage: { total_tokens: 42 },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const p = new SelfHostedChatProvider({
      endpoint: 'https://infer.potenova.ca',
      model: 'llama-3.1-8b-instruct',
      region: 'ca-central',
      apiKey: 'secret',
    });
    const r = await p.generate({ prompt: 'compare 1/2 and 1/3' });
    expect(r.text).toBe('{"answer":"gt"}');
    expect(r.units).toBe(42);
    expect(r.model).toBe('self-hosted:llama-3.1-8b-instruct');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://infer.potenova.ca/v1/chat/completions');
    expect((init as { headers: Record<string, string> }).headers.authorization).toBe(
      'Bearer secret',
    );
    const body = JSON.parse((init as { body: string }).body);
    expect(body.model).toBe('llama-3.1-8b-instruct');
  });

  it('fails closed (DEPENDENCY_UNAVAILABLE) on an HTTP error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })),
    );
    const p = new SelfHostedChatProvider({
      endpoint: 'https://infer.potenova.ca',
      model: 'm',
      region: 'ca-central',
    });
    await expect(p.generate({ prompt: 'x' })).rejects.toThrow(/self-hosted AI provider HTTP 503/);
  });
});
