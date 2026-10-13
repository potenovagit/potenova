import { projectShadow, type SkillProjection } from '@potenova/learner-state';
import {
  buildFractionsDraftGraph,
  buildEnglishDraftGraph,
  CurriculumGraph,
} from '@potenova/curriculum';
import {
  selectNextObjective,
  explainReasonCode,
  stallStatus,
  sessionBudgetStatus,
  DRAFT_PLANNER_POLICY,
  type SessionReasonCode,
  type SessionBudgetStatus,
} from '@potenova/planner';
import type { Deps } from './deps';

/**
 * Adaptive-planner orchestration shared by coaching (what to coach next), the
 * guardian report (why) and stall handling (when to change strategy). The
 * planner reads derived mastery against the review-controlled curriculum graph;
 * selection is READ-ONLY and can never set mastery (the mastery authority stays
 * the single source).
 *
 * SUBJECT-AGNOSTIC: each subject supplies its own graph, oracle-validatable
 * coachable skills, default tasks and remediation-representation ladder. The
 * planner/stall/selection code is identical across subjects — that is what shows
 * the engine is not Math-only. Skill ids are CANONICAL curriculum ids.
 */

export type Subject = 'math' | 'english';

interface SubjectPlan {
  readonly buildGraph: () => CurriculumGraph;
  /** Oracle-validatable skills the slice can coach, in canonical order. */
  readonly coachableSkillIds: readonly string[];
  /** The task offered first when the planner selects a skill. */
  readonly defaultTask: Readonly<Record<string, string>>;
  /** Strategy-change representation ladder (first = most concrete). */
  readonly remediationReps: readonly string[];
}

const SUBJECTS: Record<Subject, SubjectPlan> = {
  math: {
    buildGraph: buildFractionsDraftGraph,
    coachableSkillIds: ['SK-FR-equiv', 'SK-FR-compare'],
    defaultTask: { 'SK-FR-compare': 'frac-cmp-1', 'SK-FR-equiv': 'frac-eq-1' },
    remediationReps: ['area-model', 'number-line', 'set', 'symbolic'],
  },
  english: {
    buildGraph: buildEnglishDraftGraph,
    coachableSkillIds: ['SK-EN-plural-base', 'SK-EN-plural-sibilant'],
    defaultTask: { 'SK-EN-plural-base': 'eng-base-1', 'SK-EN-plural-sibilant': 'eng-sib-1' },
    remediationReps: ['spoken', 'picture', 'written'],
  },
};

/** The coachable skills for a subject (for the coaching task bank / routes). */
export function coachableSkillsFor(subject: Subject): readonly string[] {
  return SUBJECTS[subject].coachableSkillIds;
}

/**
 * Session item budget (ER-09): count this session's graded items and distinct
 * skills from the immutable ledger, then evaluate against the DRAFT policy. The
 * candidate skill (if given) is checked for the new-concept ceiling. Read-only.
 */
export async function sessionBudget(
  deps: Deps,
  alias: string,
  sessionId: string,
  candidateSkillId?: string,
): Promise<SessionBudgetStatus> {
  const prefix = `${sessionId}:`;
  const inSession = (await deps.evidence.listEvidenceForLearner(alias)).filter((e) =>
    e.eventId.startsWith(prefix),
  );
  const distinctSkillsThisSession = [...new Set(inSession.map((e) => e.skillId))];
  return sessionBudgetStatus(
    { itemsDelivered: inSession.length, distinctSkillsThisSession, candidateSkillId },
    DRAFT_PLANNER_POLICY,
  );
}

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

/** A mastery snapshot of every coachable skill in a subject (for the planner). */
async function coachableMastery(
  deps: Deps,
  alias: string,
  subject: Subject,
): Promise<Record<string, { confidence: number; independent: boolean }>> {
  const mastery: Record<string, { confidence: number; independent: boolean }> = {};
  for (const skillId of SUBJECTS[subject].coachableSkillIds) {
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
export async function computeNext(
  deps: Deps,
  alias: string,
  subject: Subject,
): Promise<NextRecommendation> {
  const plan = SUBJECTS[subject];
  const mastery = await coachableMastery(deps, alias, subject);
  const next = selectNextObjective({
    graph: plan.buildGraph(),
    coachableSkillIds: plan.coachableSkillIds,
    mastery,
    policy: DRAFT_PLANNER_POLICY,
  });
  return {
    skillId: next.targetSkillId,
    reasonCode: next.reasonCode,
    explanation: explainReasonCode(next.reasonCode),
    blockedSkillId: next.blockedSkillId,
    defaultTaskId: plan.defaultTask[next.targetSkillId] ?? null,
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
  subject: Subject,
): Promise<ReportRationale> {
  const plan = SUBJECTS[subject];
  const mastery = await coachableMastery(deps, alias, subject);
  const selection = selectNextObjective({
    graph: plan.buildGraph(),
    coachableSkillIds: plan.coachableSkillIds,
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
      defaultTaskId: plan.defaultTask[selection.targetSkillId] ?? null,
      plannerPolicyVersion: DRAFT_PLANNER_POLICY.policyVersion,
    },
    plannerPolicyVersion: DRAFT_PLANNER_POLICY.policyVersion,
  };
}

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
 * switch to a concrete representation (subject's ladder) not yet tried.
 *
 * Pure over the immutable ledger — it recommends, it never sets mastery.
 */
export async function assessStall(
  deps: Deps,
  alias: string,
  sessionId: string,
  skillId: string,
  subject: Subject,
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

  const plan = SUBJECTS[subject];
  const base = {
    stalled: true as const,
    consecutiveWrong: status.consecutiveWrong,
    plannerPolicyVersion: DRAFT_PLANNER_POLICY.policyVersion,
  };

  // A coachable prerequisite that is not yet independent = the likely real gap.
  const graph = plan.buildGraph();
  const coachable = new Set<string>(plan.coachableSkillIds);
  const prereqs = graph.directPrerequisites(skillId).filter((p) => coachable.has(p));
  for (const p of prereqs) {
    const proj = await projectSkill(deps, alias, p);
    if (!proj.dimensions.independent) {
      return {
        ...base,
        strategy: 'REMEDIATE_PREREQUISITE',
        suggestedSkillId: p,
        suggestedTaskId: plan.defaultTask[p],
        message: 'Stuck here — stepping back to a foundational skill this one builds on.',
      };
    }
  }

  // Otherwise change the representation: one from the subject's ladder not yet tried.
  const tried = new Set(inSession.map((e) => e.representation));
  const suggestedRepresentation =
    plan.remediationReps.find((r) => !tried.has(r)) ?? plan.remediationReps[0];
  return {
    ...base,
    strategy: 'SWITCH_REPRESENTATION',
    suggestedRepresentation,
    message: `Stuck here — let's try it with a ${suggestedRepresentation} instead.`,
  };
}
