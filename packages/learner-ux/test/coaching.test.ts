import { describe, it, expect } from 'vitest';
import { feedbackFor, homeworkAssistance, type Outcome } from '@potenova/learner-ux';

describe('safe feedback + homework guard (AT-19; DIA-011 tone)', () => {
  it('no outcome ever produces shaming feedback', () => {
    for (const o of ['correct', 'incorrect', 'partial', 'stopped'] as Outcome[]) {
      expect(feedbackFor(o).shaming).toBe(false);
    }
  });

  it('an incorrect attempt gets a constructive next step, not a failure label', () => {
    const fb = feedbackFor('incorrect');
    expect(fb.tone).toBe('encouraging');
    expect(fb.nextStep).toBe('try_another_representation');
  });

  it('stopping early is acknowledged neutrally with a resume path', () => {
    const fb = feedbackFor('stopped');
    expect(fb.tone).toBe('neutral');
    expect(fb.nextStep).toBe('resume_anytime');
  });

  it('AT-19: "solve it for me" coaches an analogous concept, never completes the original', () => {
    const a = homeworkAssistance({ completeOriginalRequested: true });
    expect(a.mode).toBe('COACH_ANALOGOUS');
    expect(a.completesOriginal).toBe(false);
  });
});
