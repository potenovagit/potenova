import { describe, it, expect } from 'vitest';
import {
  buildDateCalendarDraftGraph,
  DATE_CALENDAR_SKILLS,
  DATE_CALENDAR_MISCONCEPTIONS,
  DATE_CALENDAR_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT date-calendar strand (G1 E2.3 — date arithmetic across months)', () => {
  const g = buildDateCalendarDraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(DATE_CALENDAR_SKILLS.length);
    expect(DATE_CALENDAR_SKILLS.map((s) => s.skillId)).toEqual(['SK-TIME-date-offset']);
  });

  it('seeds a misconception KB tied to the skill, with a remediation strategy', () => {
    const strategyIds = new Set(DATE_CALENDAR_STRATEGIES.map((s) => s.strategyId));
    expect(DATE_CALENDAR_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const m of DATE_CALENDAR_MISCONCEPTIONS) {
      expect(m.skillId).toBe('SK-TIME-date-offset');
      for (const sid of m.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Time competency graph (time:date-arithmetic)', () => {
    expect(DATE_CALENDAR_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(DATE_CALENDAR_SKILLS.every((s) => s.competency === 'time:date-arithmetic')).toBe(true);
  });
});
