import { describe, it, expect } from 'vitest';
import { openChallenge, beginReview, resolveChallenge } from '@potenova/parent';
import { isDomainError } from '@potenova/contracts';

describe('challenge / dispute flow (PAR-011/012; AT-25)', () => {
  it('AT-25: an open challenge withholds demotion while pending review', () => {
    const c = openChallenge('case-1', 'evt-9', 'parent');
    expect(c.state).toBe('OPEN');
    expect(c.demotionWithheld).toBe(true);
  });

  it('resolves by appending a provenance-stamped correction (never a mastery write)', () => {
    const c = beginReview(openChallenge('case-1', 'evt-9', 'child'));
    const { case: resolved, correction } = resolveChallenge(c, {
      upheld: true,
      reason: 'valid alternative strategy',
      correctionId: 'corr-1',
      at: '2026-10-10T00:00:00Z',
    });
    expect(resolved.state).toBe('RESOLVED');
    expect(correction.targetEventId).toBe('evt-9');
    expect(correction.retract).toBe(true); // upheld → disputed observation retracted
    expect(correction.reason).toBe('valid alternative strategy');
  });

  it('cannot resolve a challenge that is not under review', () => {
    try {
      resolveChallenge(openChallenge('case-1', 'evt-9', 'parent'), {
        upheld: false,
        reason: 'x',
        correctionId: 'c',
        at: '2026-10-10T00:00:00Z',
      });
      throw new Error('expected CONFLICT');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('CONFLICT');
    }
  });
});
