import type { SkillState } from '@potenova/domain-core';
import type { PlannerPolicy } from './policy';

/**
 * Post-absence retention checks (AI Learning §4; DIA-009; AT-57).
 *
 * On return after a long absence, the planner briefly re-checks only the
 * previously-mastered skills whose elapsed time crosses the decay window — it
 * does NOT redo the whole placement test. Fresh skills, and skills that were
 * never mastered, are not swept into retention checks.
 */

const MASTERED_STATES: ReadonlySet<SkillState> = new Set<SkillState>([
  'INDEPENDENT',
  'RETAINED',
  'TRANSFERABLE',
]);

export interface RetentionCandidate {
  readonly skillId: string;
  readonly state: SkillState;
  /** ISO time the skill was last demonstrated unaided. */
  readonly lastDemonstratedAt: string;
}

export interface RetentionCheck {
  readonly skillId: string;
  readonly reasonCode: 'REVIEW_DUE';
}

/**
 * Select brief retention checks for threatened skills only. Pure; deterministic
 * ordering by skillId.
 */
export function planReturnRetentionChecks(
  candidates: readonly RetentionCandidate[],
  nowMs: number,
  policy: PlannerPolicy,
): RetentionCheck[] {
  return candidates
    .filter((c) => MASTERED_STATES.has(c.state))
    .filter((c) => nowMs - Date.parse(c.lastDemonstratedAt) >= policy.retentionDecayWindowMs)
    .map((c): RetentionCheck => ({ skillId: c.skillId, reasonCode: 'REVIEW_DUE' }))
    .sort((a, b) => a.skillId.localeCompare(b.skillId));
}
