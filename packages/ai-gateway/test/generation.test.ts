import { describe, it, expect } from 'vitest';
import { StubGenerativeProvider, AzureOpenAiChatProvider } from '../src/generation';

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
