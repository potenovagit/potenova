import { describe, it, expect } from 'vitest';
import {
  buildScientificNotationG8DraftGraph,
  SCIENTIFIC_NOTATION_G8_SKILLS,
  SCIENTIFIC_NOTATION_G8_MISCONCEPTIONS,
  SCIENTIFIC_NOTATION_G8_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT scientific-notation strand (G8 B1.1)', () => {
  const g = buildScientificNotationG8DraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(SCIENTIFIC_NOTATION_G8_SKILLS.length);
    expect(SCIENTIFIC_NOTATION_G8_SKILLS.map((s) => s.skillId)).toEqual([
      'SK-NS-scientific-notation',
    ]);
  });

  it('seeds the wrong-zero-count misconception tied to the skill, with a strategy', () => {
    const strategyIds = new Set(SCIENTIFIC_NOTATION_G8_STRATEGIES.map((s) => s.strategyId));
    expect(SCIENTIFIC_NOTATION_G8_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const mc of SCIENTIFIC_NOTATION_G8_MISCONCEPTIONS) {
      expect(mc.skillId).toBe('SK-NS-scientific-notation');
      for (const sid of mc.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Number powers graph', () => {
    expect(SCIENTIFIC_NOTATION_G8_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(SCIENTIFIC_NOTATION_G8_SKILLS.every((s) => s.competency === 'number:powers')).toBe(true);
  });
});
