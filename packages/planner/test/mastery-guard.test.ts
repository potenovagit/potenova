import { describe, it, expect } from 'vitest';
import { parentMasteryAssertionIsContextOnly, transcriptUsableForGrading } from '@potenova/planner';

describe('mastery-integrity guards (AT-28/56)', () => {
  it('AT-56: a parent "mark mastered" is context only and needs an independent check', () => {
    const r = parentMasteryAssertionIsContextOnly();
    expect(r.accepted).toBe(false);
    expect(r.recordAs).toBe('CONTEXT_ONLY');
    expect(r.requiresIndependentCheck).toBe(true);
  });

  it('AT-28: a low-confidence transcript is not usable for a confident grade change', () => {
    expect(transcriptUsableForGrading(0.9)).toBe(true);
    expect(transcriptUsableForGrading(0.5)).toBe(false);
  });
});
