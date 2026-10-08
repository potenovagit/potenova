import { describe, it, expect } from 'vitest';
import { makeFamily, makeEvidenceEvents, SYNTHETIC_MARKER } from '@potenova/fixtures';

describe('synthetic fixtures (CLAUDE.md non-negotiable, AI-003, AT-51)', () => {
  it('are deterministic for a given seed', () => {
    expect(makeFamily(42)).toEqual(makeFamily(42));
    expect(makeEvidenceEvents('L', 7)).toEqual(makeEvidenceEvents('L', 7));
  });

  it('are explicitly marked synthetic (loaders must refuse unmarked data)', () => {
    const f = makeFamily(1);
    expect(f.marker).toBe(SYNTHETIC_MARKER);
    expect(f.learners.every((l) => l.marker === SYNTHETIC_MARKER)).toBe(true);
    expect(f.familyAlias.startsWith('syn-')).toBe(true);
  });

  it('generate the requested shape', () => {
    const f = makeFamily(3, 3);
    expect(f.learners).toHaveLength(3);
    expect(makeEvidenceEvents('L', 3, 9)).toHaveLength(9);
  });
});
