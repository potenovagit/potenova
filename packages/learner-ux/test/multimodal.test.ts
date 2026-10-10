import { describe, it, expect } from 'vitest';
import {
  captionsRequiredForAudio,
  voiceTurnDecision,
  confirmFact,
  factsUsableForPlanning,
  type ExtractedFact,
} from '@potenova/learner-ux';
import { isDomainError } from '@potenova/contracts';

const fact = (over: Partial<ExtractedFact> = {}): ExtractedFact => ({
  factId: 'f1',
  label: 'Grade 4 math',
  value: 'B',
  recognitionConfidence: 0.6,
  status: 'provisional',
  confirmedBy: null,
  ...over,
});

describe('voice/caption path (AT-28)', () => {
  it('audio always requires captions', () => {
    expect(captionsRequiredForAudio()).toBe(true);
  });

  it('AT-28: a low-confidence reading asks for clarification, not a grade', () => {
    expect(voiceTurnDecision(0.9)).toBe('USE');
    expect(voiceTurnDecision(0.5)).toBe('REQUEST_CLARIFICATION');
  });
});

describe('uploaded report-card confirmation (AT-18)', () => {
  it('provisional facts do not influence planning until confirmed', () => {
    const facts = [fact({ factId: 'f1' }), fact({ factId: 'f2' })];
    expect(factsUsableForPlanning(facts)).toHaveLength(0);
    const confirmed = confirmFact(facts[0]!, 'guardian-1');
    expect(confirmed.status).toBe('confirmed');
    expect(factsUsableForPlanning([confirmed, facts[1]!])).toEqual([confirmed]);
  });

  it('confirmation requires a guardian', () => {
    try {
      confirmFact(fact(), '');
      throw new Error('expected AUTH_REQUIRED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('AUTH_REQUIRED');
    }
  });
});
