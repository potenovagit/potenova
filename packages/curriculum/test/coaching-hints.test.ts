import { describe, it, expect } from 'vitest';
import {
  hintsForSkill,
  FRACTION_MISCONCEPTIONS,
  FRACTION_STRATEGIES,
  ENGLISH_MISCONCEPTIONS,
  ENGLISH_STRATEGIES,
} from '../src';

describe('hintsForSkill', () => {
  it('resolves a skill’s misconception to its remediation strategies in order', () => {
    const hints = hintsForSkill('SK-FR-compare', FRACTION_MISCONCEPTIONS, FRACTION_STRATEGIES);
    expect(hints.map((h) => h.strategyId)).toEqual(['ST-area-model', 'ST-number-line']);
    expect(hints[0].misconceptionId).toBe('MC-FR-denom-size');
    expect(hints[0].intent.length).toBeGreaterThan(0);
  });

  it('returns [] for a skill with no misconception in the KB', () => {
    expect(hintsForSkill('SK-FR-equiv', FRACTION_MISCONCEPTIONS, FRACTION_STRATEGIES)).toEqual([]);
  });

  it('resolves the English sibilant-plural misconception to its strategies', () => {
    const hints = hintsForSkill(
      'SK-EN-plural-sibilant',
      ENGLISH_MISCONCEPTIONS,
      ENGLISH_STRATEGIES,
    );
    expect(hints[0].misconceptionId).toBe('MC-EN-sibilant-bare-s');
    expect(hints.map((h) => h.strategyId)).toEqual(['ST-en-say-aloud', 'ST-en-ending-pattern']);
    expect(hintsForSkill('SK-EN-plural-base', ENGLISH_MISCONCEPTIONS, ENGLISH_STRATEGIES)).toEqual(
      [],
    );
  });

  it('skips a strategy id the KB does not define', () => {
    const misconceptions = [
      {
        misconceptionId: 'MC-X',
        skillId: 'SK-X',
        pattern: 'x',
        probeIds: [],
        remediationStrategyIds: ['ST-area-model', 'ST-missing'],
        version: 'v',
      },
    ];
    const hints = hintsForSkill('SK-X', misconceptions, FRACTION_STRATEGIES);
    expect(hints.map((h) => h.strategyId)).toEqual(['ST-area-model']);
  });
});
