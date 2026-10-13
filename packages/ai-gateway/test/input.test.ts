import { describe, it, expect } from 'vitest';
import { isDomainError } from '@potenova/contracts';
import { StubInputProvider } from '../src/input';

describe('StubInputProvider', () => {
  it('returns the scripted transcript + confidence and runs in a Canadian region', async () => {
    const p = new StubInputProvider({ text: 'gt', confidence: 0.9 });
    expect(p.region).toBe('ca-central');
    const r = await p.transcribe({ audioRef: 'a1', synthetic: true });
    expect(r.text).toBe('gt');
    expect(r.confidence).toBe(0.9);
    const o = await p.extractText({ imageRef: 'i1', synthetic: true });
    expect(o.text).toBe('gt');
  });

  it('fails closed on non-synthetic media', async () => {
    const p = new StubInputProvider({ text: 'gt', confidence: 0.9 });
    try {
      await p.transcribe({ audioRef: 'a1', synthetic: false });
      expect.unreachable('should fail closed');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });
});
