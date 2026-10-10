import { describe, it, expect } from 'vitest';
import {
  effectiveSessionCap,
  notificationAllowedDuringVacation,
  onVacationReturn,
} from '@potenova/parent';
import { DRAFT_PLANNER_POLICY, type RetentionCandidate } from '@potenova/planner';

describe('preference controls + Vacation Mode (PAR-007/009; AT-31)', () => {
  it('PAR-007: parent cap may shorten but never exceed the safety maximum', () => {
    expect(effectiveSessionCap(20, 45)).toBe(20); // parent shortens
    expect(effectiveSessionCap(90, 45)).toBe(45); // cannot exceed safety max
  });

  it('AT-31: Vacation Mode suppresses nonessential notifications but keeps essential ones', () => {
    expect(notificationAllowedDuringVacation('safety')).toBe(true);
    expect(notificationAllowedDuringVacation('account')).toBe(true);
    expect(notificationAllowedDuringVacation('streak_reminder')).toBe(false);
    expect(notificationAllowedDuringVacation('marketing')).toBe(false);
  });

  it('AT-31: return runs targeted retention checks, not a full re-diagnostic', () => {
    const now = Date.parse('2026-10-10T00:00:00Z');
    const candidates: RetentionCandidate[] = [
      {
        skillId: 'SK-FR-unit',
        state: 'INDEPENDENT',
        lastDemonstratedAt: new Date(now - 40 * 86400000).toISOString(),
      },
      {
        skillId: 'SK-FR-fresh',
        state: 'RETAINED',
        lastDemonstratedAt: new Date(now - 2 * 86400000).toISOString(),
      },
    ];
    const r = onVacationReturn(candidates, now, DRAFT_PLANNER_POLICY);
    expect(r.fullRediagnostic).toBe(false);
    expect(r.retentionChecks.map((c) => c.skillId)).toEqual(['SK-FR-unit']);
  });
});
