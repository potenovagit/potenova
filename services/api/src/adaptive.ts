import { projectShadow, type SkillProjection } from '@potenova/learner-state';
import { buildFractionsDraftGraph } from '@potenova/curriculum';
import {
  selectNextObjective,
  explainReasonCode,
  stallStatus,
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

/** Concrete-first remediation representation ladder (AT-08 strategy change). */
const REMEDIATION_REPS = ['area-model', 'number-line', 'set', 'symbolic'] as const;

export type StallStrategy = 'REMEDIATE_PREREQUISITE' | 'SWITCH_REPRESENTATION';

export interface StallCoaching {
  stalled: true;
  consecutiveWrong: number;
  strategy: StallStrategy;
  /** For REMEDIATE_PREREQUISITE: the prerequisite skill + a task to drop to. */
  suggestedSkillId?: string;
  suggestedTaskId?: string;
  /** For SWITCH_REPRESENTATION: a concrete model not yet tried this session. */
  suggestedRepresentation?: string;
  message: string;
  plannerPolicyVersion: string;
}

/**
 * On repeated wrong answers (>= policy.stallAttempts consecutive, in-session),
 * the strategy MUST change (AT-08) — never re-serve the same task. Prefer
 * dropping to a weak coachable prerequisite (the likely real gap); otherwise
 * switch to a concrete representation the learner hasn't worked in yet.
 *
 * Pure over the immutable ledger — it recommends, it never sets mastery.
 */
export async function assessStall(
  deps: Deps,
  alias: string,
  sessionId: string,
  skillId: string,
): Promise<StallCoaching | null> {
  const prefix = `${sessionId}:`;
  const inSession = (await deps.evidence.listEvidence(alias, skillId))
    .filter((e) => e.eventId.startsWith(prefix))
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.eventId.localeCompare(b.eventId));

  const status = stallStatus(
    inSession.map((e) => e.correct),
    DRAFT_PLANNER_POLICY,
  );
  if (!status.stalled) return null;

  const base = {
    stalled: true as const,
    consecutiveWrong: status.consecutiveWrong,
    plannerPolicyVersion: DRAFT_PLANNER_POLICY.policyVersion,
  };

  // A coachable prerequisite that is not yet independent = the likely real gap.
  const graph = buildFractionsDraftGraph();
  const coachable = new Set<string>(COACHABLE_SKILLS);
  const prereqs = graph.directPrerequisites(skillId).filter((p) => coachable.has(p));
  for (const p of prereqs) {
    const proj = await projectSkill(deps, alias, p);
    if (!proj.dimensions.independent) {
      return {
        ...base,
        strategy: 'REMEDIATE_PREREQUISITE',
        suggestedSkillId: p,
        suggestedTaskId: DEFAULT_TASK[p],
        message: 'Stuck here — stepping back to a foundational skill this one builds on.',
      };
    }
  }

  // Otherwise change the representation: a concrete model not yet tried.
  const tried = new Set(inSession.map((e) => e.representation));
  const suggestedRepresentation =
    REMEDIATION_REPS.find((r) => !tried.has(r)) ?? REMEDIATION_REPS[0];
  return {
    ...base,
    strategy: 'SWITCH_REPRESENTATION',
    suggestedRepresentation,
    message: `Stuck here — let's try it with a ${suggestedRepresentation} instead.`,
  };
}
