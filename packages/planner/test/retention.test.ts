import { describe, it, expect } from 'vitest';
import {
  planReturnRetentionChecks,
  DRAFT_PLANNER_POLICY,
  type RetentionCandidate,
} from '@potenova/planner';

const policy = DRAFT_PLANNER_POLICY; // decay window = 21 days
const now = Date.parse('2026-10-10T00:00:00Z');
const daysAgo = (d: number) => new Date(now - d * 24 * 60 * 60 * 1000).toISOString();

describe('post-absence retention checks (DIA-009, AT-57)', () => {
  it('AT-57: checks only threatened mastered skills, not a whole re-placement', () => {
    const candidates: RetentionCandidate[] = [
      { skillId: 'stale-mastered', state: 'INDEPENDENT', lastDemonstratedAt: daysAgo(40) },
      { skillId: 'fresh-mastered', state: 'RETAINED', lastDemonstratedAt: daysAgo(3) },
      { skillId: 'never-mastered', state: 'DEVELOPING', lastDemonstratedAt: daysAgo(90) },
      { skillId: 'unassessed', state: 'UNASSESSED', lastDemonstratedAt: daysAgo(90) },
    ];
    const checks = planReturnRetentionChecks(candidates, now, policy);
    expect(checks.map((c) => c.skillId)).toEqual(['stale-mastered']);
    expect(checks[0]!.reasonCode).toBe('REVIEW_DUE');
  });

  it('returns nothing when all mastered skills are still fresh', () => {
    const candidates: RetentionCandidate[] = [
      { skillId: 'a', state: 'TRANSFERABLE', lastDemonstratedAt: daysAgo(2) },
    ];
    expect(planReturnRetentionChecks(candidates, now, policy)).toHaveLength(0);
  });
});
