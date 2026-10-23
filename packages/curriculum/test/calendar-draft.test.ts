import { describe, it, expect } from 'vitest';
import {
  buildCalendarDraftGraph,
  CALENDAR_SKILLS,
  CALENDAR_MISCONCEPTIONS,
  CALENDAR_STRATEGIES,
} from '@potenova/curriculum';

describe('DRAFT calendar strand (G1 E2.3 — days of the week)', () => {
  const g = buildCalendarDraftGraph();

  it('is a single-skill acyclic graph', () => {
    expect(g.hasCycle()).toBe(false);
    expect(g.skillCount()).toBe(CALENDAR_SKILLS.length);
    expect(CALENDAR_SKILLS.map((s) => s.skillId)).toEqual(['SK-TIME-calendar-day']);
  });

  it('seeds a misconception KB tied to the skill, with a remediation strategy', () => {
    const strategyIds = new Set(CALENDAR_STRATEGIES.map((s) => s.strategyId));
    expect(CALENDAR_MISCONCEPTIONS.length).toBeGreaterThanOrEqual(1);
    for (const m of CALENDAR_MISCONCEPTIONS) {
      expect(m.skillId).toBe('SK-TIME-calendar-day');
      for (const sid of m.remediationStrategyIds) expect(strategyIds.has(sid)).toBe(true);
    }
  });

  it('is a Time competency graph (time:calendar)', () => {
    expect(CALENDAR_SKILLS.every((s) => s.domain === 'math')).toBe(true);
    expect(CALENDAR_SKILLS.every((s) => s.competency === 'time:calendar')).toBe(true);
  });
});
