import { describe, it, expect } from 'vitest';
import { buildEnglishDraftGraph } from '../src';

describe('English draft graph', () => {
  it('makes the base plural a prerequisite of the sibilant plural', () => {
    const g = buildEnglishDraftGraph();
    expect(g.directPrerequisites('SK-EN-plural-sibilant')).toContain('SK-EN-plural-base');
    expect(g.directPrerequisites('SK-EN-plural-base')).toEqual([]);
  });

  it('is acyclic', () => {
    expect(buildEnglishDraftGraph().hasCycle()).toBe(false);
  });
});
