import { describe, it, expect } from 'vitest';
import { layoutProfileFor, DRAFT_UX_POLICY } from '@potenova/learner-ux';

describe('age-band responsive layout (AT-47)', () => {
  it('primary gets the largest targets/text, fewest items, icon-led, read-aloud on', () => {
    const p = layoutProfileFor('primary', DRAFT_UX_POLICY);
    expect(p.iconLed).toBe(true);
    expect(p.readAloudDefault).toBe(true);
    expect(p.maxItemsPerScreen).toBe(1);
  });

  it('target size and text scale shrink monotonically across bands', () => {
    const pr = layoutProfileFor('primary', DRAFT_UX_POLICY);
    const jr = layoutProfileFor('junior', DRAFT_UX_POLICY);
    const it_ = layoutProfileFor('intermediate', DRAFT_UX_POLICY);
    expect(pr.minTapTargetPx).toBeGreaterThan(jr.minTapTargetPx);
    expect(jr.minTapTargetPx).toBeGreaterThanOrEqual(it_.minTapTargetPx);
    expect(pr.textScale).toBeGreaterThan(it_.textScale);
  });

  it('intermediate is not icon-led', () => {
    expect(layoutProfileFor('intermediate', DRAFT_UX_POLICY).iconLed).toBe(false);
  });
});
