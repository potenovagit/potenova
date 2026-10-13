import { projectShadow, type SkillProjection } from '@potenova/learner-state';
import { buildFractionsDraftGraph } from '@potenova/curriculum';
import {
  selectNextObjective,
  explainReasonCode,
  DRAFT_PLANNER_POLICY,
  type SessionReasonCode,
} from '@potenova/planner';
import type { Deps } from './deps';

/**
 * Adaptive-planner orchestration shared by coaching (what to coach next) and the
 * guardian session report (why a skill was chosen). The planner reads derived
 * mastery against the review-controlled curriculum graph; selection is READ-ONLY
 * and can never set mastery (the mastery authority stays the single source).
 *
 * Skill ids are CANONICAL curriculum ids. The coachable set is the
 * oracle-validatable subset for the synthetic slice.
 */

export const EQUIV = 'SK-FR-equiv';
export const COMPARE = 'SK-FR-compare';
/** Oracle-validatable skills the slice can coach, in canonical order. */
export const COACHABLE_SKILLS = [EQUIV, COMPARE] as const;
/** The task offered first when the planner selects a skill. */
export const DEFAULT_TASK: Readonly<Record<string, string>> = {
  [COMPARE]: 'frac-cmp-1',
  [EQUIV]: 'frac-eq-1',
};

/** Re-derive a skill's mastery from the immutable ledger (never hand-set). */
export async function projectSkill(
  deps: Deps,
  alias: string,
  skillId: string,
): Promise<SkillProjection> {
  const events = await deps.evidence.listEvidence(alias, skillId);
  const corrections = await deps.evidence.listCorrections(events.map((e) => e.eventId));
  return projectShadow(alias, skillId, events, corrections, deps.policies.mastery);
}

/** A mastery snapshot of every coachable skill (for the planner). */
async function coachableMastery(
  deps: Deps,
  alias: string,
): Promise<Record<string, { confidence: number; independent: boolean }>> {
  const mastery: Record<string, { confidence: number; independent: boolean }> = {};
  for (const skillId of COACHABLE_SKILLS) {
    const p = await projectSkill(deps, alias, skillId);
    mastery[skillId] = { confidence: p.confidence, independent: p.dimensions.independent };
  }
  return mastery;
}

export interface NextRecommendation {
  skillId: string;
  reasonCode: SessionReasonCode;
  /** Parent-facing rationale for the reason code. */
  explanation: string;
  blockedSkillId: string | null;
  defaultTaskId: string | null;
  plannerPolicyVersion: string;
}

/** Ask the planner what to coach next off the current derived mastery. */
export async function computeNext(deps: Deps, alias: string): Promise<NextRecommendation> {
  const mastery = await coachableMastery(deps, alias);
  const next = selectNextObjective({
    graph: buildFractionsDraftGraph(),
    coachableSkillIds: COACHABLE_SKILLS,
    mastery,
    policy: DRAFT_PLANNER_POLICY,
  });
  return {
    skillId: next.targetSkillId,
    reasonCode: next.reasonCode,
    explanation: explainReasonCode(next.reasonCode),
    blockedSkillId: next.blockedSkillId,
    defaultTaskId: DEFAULT_TASK[next.targetSkillId] ?? null,
    plannerPolicyVersion: DRAFT_PLANNER_POLICY.policyVersion,
  };
}

export interface SkillRationale {
  skillId: string;
  reasonCode: SessionReasonCode | null;
  explanation: string;
}

export interface ReportRationale {
  /** Why each worked skill sits where it does in the plan, in plain language. */
  bySkill: SkillRationale[];
  /** What the planner would coach next, and why. */
  nextObjective: NextRecommendation;
  plannerPolicyVersion: string;
}

/**
 * Explain, for a guardian, why each skill worked this session has the standing it
 * does — the planner's audit reason code rendered as plain language — plus what
 * it would do next. Pure reporting over current mastery; it changes nothing.
 */
export async function buildReportRationale(
  deps: Deps,
  alias: string,
  workedSkillIds: readonly string[],
): Promise<ReportRationale> {
  const mastery = await coachableMastery(deps, alias);
  const selection = selectNextObjective({
    graph: buildFractionsDraftGraph(),
    coachableSkillIds: COACHABLE_SKILLS,
    mastery,
    policy: DRAFT_PLANNER_POLICY,
  });
  const reasonBySkill = new Map(selection.ranked.map((o) => [o.skillId, o.reasonCode]));

  const bySkill: SkillRationale[] = workedSkillIds.map((skillId) => {
    const reasonCode = reasonBySkill.get(skillId) ?? null;
    return {
      skillId,
      reasonCode,
      explanation: reasonCode
        ? explainReasonCode(reasonCode)
        : 'Not part of the current adaptive plan for this subject.',
    };
  });

  return {
    bySkill,
    nextObjective: {
      skillId: selection.targetSkillId,
      reasonCode: selection.reasonCode,
      explanation: explainReasonCode(selection.reasonCode),
      blockedSkillId: selection.blockedSkillId,
      defaultTaskId: DEFAULT_TASK[selection.targetSkillId] ?? null,
      plannerPolicyVersion: DRAFT_PLANNER_POLICY.policyVersion,
    },
    plannerPolicyVersion: DRAFT_PLANNER_POLICY.policyVersion,
  };
}
