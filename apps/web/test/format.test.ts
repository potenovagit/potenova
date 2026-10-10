import { describe, it, expect } from 'vitest';
import { bandForGrade, confidencePct, standingLabel, standingTone } from '../src/format';

describe('web presentation helpers', () => {
  it('labels every known standing in parent/child-friendly words', () => {
    expect(standingLabel('demonstrated')).toBe('Demonstrated');
    expect(standingLabel('developing')).toBe('Developing');
    expect(standingLabel('emerging')).toBe('Emerging');
    expect(standingLabel('needs_review')).toBe('Needs a closer look');
    expect(standingLabel('unknown')).toBe('Not yet assessed');
  });

  it('falls back to humanised text for an unexpected standing', () => {
    expect(standingLabel('some_new_state')).toBe('some new state');
  });

  it('maps standings to a colour tone', () => {
    expect(standingTone('demonstrated')).toBe('good');
    expect(standingTone('developing')).toBe('mid');
    expect(standingTone('emerging')).toBe('mid');
    expect(standingTone('unknown')).toBe('low');
    expect(standingTone('needs_review')).toBe('low');
  });

  it('clamps and rounds confidence to a percent', () => {
    expect(confidencePct(0)).toBe('0%');
    expect(confidencePct(0.5)).toBe('50%');
    expect(confidencePct(0.834)).toBe('83%');
    expect(confidencePct(1)).toBe('100%');
    expect(confidencePct(1.4)).toBe('100%');
    expect(confidencePct(-0.2)).toBe('0%');
  });

  it('chooses an age band from grade (LUX-001)', () => {
    expect(bandForGrade(1)).toBe('primary');
    expect(bandForGrade(3)).toBe('primary');
    expect(bandForGrade(4)).toBe('junior');
    expect(bandForGrade(6)).toBe('junior');
    expect(bandForGrade(7)).toBe('intermediate');
    expect(bandForGrade(8)).toBe('intermediate');
  });
});
