import {
  projectShadow,
  assertMasteryPolicyApproved,
  type SkillProjection,
} from '@potenova/learner-state';
import { DomainError } from '@potenova/contracts';
import {
  buildFractionsDraftGraph,
  buildEnglishDraftGraph,
  hintsForSkill,
  FRACTION_MISCONCEPTIONS,
  FRACTION_STRATEGIES,
  ENGLISH_MISCONCEPTIONS,
  ENGLISH_STRATEGIES,
  CurriculumGraph,
  type MisconceptionDefinition,
  type InstructionalStrategy,
  type SkillHint,
} from '@potenova/curriculum';
import {
  selectNextObjective,
  explainReasonCode,
  stallStatus,
  sessionBudgetStatus,
  DRAFT_PLANNER_POLICY,
  type SessionReasonCode,
  type SessionBudgetStatus,
  type SkillMastery,
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
  /** Misconception KB for the hint ladder (empty when a subject has none yet). */
  readonly misconceptions: readonly MisconceptionDefinition[];
  readonly strategies: readonly InstructionalStrategy[];
  /** The transfer (novel-context) task offered when a mastered skill earns one. */
  readonly transferTask: Readonly<Record<string, string>>;
}

const SUBJECTS: Record<Subject, SubjectPlan> = {
  math: {
    buildGraph: buildFractionsDraftGraph,
    coachableSkillIds: ['SK-FR-equiv', 'SK-FR-compare'],
    defaultTask: { 'SK-FR-compare': 'frac-cmp-1', 'SK-FR-equiv': 'frac-eq-1' },
    remediationReps: ['area-model', 'number-line', 'set', 'symbolic'],
    misconceptions: FRACTION_MISCONCEPTIONS,
    strategies: FRACTION_STRATEGIES,
    transferTask: { 'SK-FR-compare': 'frac-xfer-cmp', 'SK-FR-equiv': 'frac-xfer-eq' },
  },
  english: {
    buildGraph: buildEnglishDraftGraph,
    coachableSkillIds: ['SK-EN-plural-base', 'SK-EN-plural-sibilant'],
    defaultTask: { 'SK-EN-plural-base': 'eng-base-1', 'SK-EN-plural-sibilant': 'eng-sib-1' },
    remediationReps: ['spoken', 'picture', 'written'],
    misconceptions: ENGLISH_MISCONCEPTIONS,
    strategies: ENGLISH_STRATEGIES,
    transferTask: { 'SK-EN-plural-base': 'eng-xfer-base', 'SK-EN-plural-sibilant': 'eng-xfer-sib' },
  },
};

/** The coachable skills for a subject (for the coaching task bank / routes). */
export function coachableSkillsFor(subject: Subject): readonly string[] {
  return SUBJECTS[subject].coachableSkillIds;
}

/** The subject a canonical skill belongs to (via its curriculum graph), or null. */
export function subjectOfSkill(skillId: string): Subject | null {
  for (const subject of Object.keys(SUBJECTS) as Subject[]) {
    try {
      SUBJECTS[subject].buildGraph().getSkill(skillId);
      return subject;
    } catch {
      // not in this subject's graph — try the next
    }
  }
  return null;
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

/**
 * Is this skill currently review-due for the learner? (Independent, but last
 * practised longer ago than the planner's decay window.) Used to tag a review
 * turn so a delayed retrieval resolves RETAINED. Read-only.
 */
export async function reviewDueFor(deps: Deps, alias: string, skillId: string): Promise<boolean> {
  const events = await deps.evidence.listEvidence(alias, skillId);
  const corrections = await deps.evidence.listCorrections(events.map((e) => e.eventId));
  const p = projectShadow(alias, skillId, events, corrections, deps.policies.mastery);
  if (!p.dimensions.independent) return false;
  const times = events.map((e) => Date.parse(e.observedAt)).filter((t) => !Number.isNaN(t));
  if (times.length === 0) return false;
  return Date.now() - Math.max(...times) > DRAFT_PLANNER_POLICY.retentionDecayWindowMs;
}

/** Projection states that count as "mastered" for session completion. */
const MASTERED_STATES = new Set(['INDEPENDENT', 'RETAINED', 'TRANSFERABLE']);

/**
 * Has every coachable skill in the subject reached mastery (INDEPENDENT /
 * RETAINED / TRANSFERABLE)? Used to complete a session cleanly when there is
 * nothing left to coach. Read-only.
 */
export async function allCoachableMastered(
  deps: Deps,
  alias: string,
  subject: Subject,
): Promise<boolean> {
  for (const skillId of SUBJECTS[subject].coachableSkillIds) {
    const p = await projectSkill(deps, alias, skillId);
    if (!MASTERED_STATES.has(p.state)) return false;
  }
  return true;
}

/**
 * A mastery snapshot of every coachable skill in a subject (for the planner),
 * including each skill's most recent trusted practice time for retention/review.
 */
async function coachableMastery(
  deps: Deps,
  alias: string,
  subject: Subject,
): Promise<Record<string, SkillMastery>> {
  const mastery: Record<string, SkillMastery> = {};
  for (const skillId of SUBJECTS[subject].coachableSkillIds) {
    const events = await deps.evidence.listEvidence(alias, skillId);
    const corrections = await deps.evidence.listCorrections(events.map((e) => e.eventId));
    const p = projectShadow(alias, skillId, events, corrections, deps.policies.mastery);
    const times = events.map((e) => Date.parse(e.observedAt)).filter((t) => !Number.isNaN(t));
    mastery[skillId] = {
      confidence: p.confidence,
      independent: p.dimensions.independent,
      transferable: p.dimensions.transferable,
      lastPracticedAt: times.length ? Math.max(...times) : undefined,
    };
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
  // A transfer check points at the novel-context task; otherwise the normal task.
  const defaultTaskId =
    next.reasonCode === 'TRANSFER_CHECK'
      ? (plan.transferTask[next.targetSkillId] ?? plan.defaultTask[next.targetSkillId] ?? null)
      : (plan.defaultTask[next.targetSkillId] ?? null);
  return {
    skillId: next.targetSkillId,
    reasonCode: next.reasonCode,
    explanation: explainReasonCode(next.reasonCode),
    blockedSkillId: next.blockedSkillId,
    defaultTaskId,
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

/**
 * The first rung of the coaching ladder: a targeted, AUTHORED hint for an early
 * wrong answer, resolved from the subject's misconception → remediation-strategy
 * KB. The stall-driven strategy change (assessStall) is the next rung. Returns
 * null when the KB has no misconception for the skill. Pure.
 */
export interface Hint {
  skillId: string;
  level: number;
  misconceptionId: string;
  strategyId: string;
  /** Child-facing, actionable instruction (the strategy intent). */
  message: string;
  representations: readonly string[];
  /** The full ordered ladder of authored hints for the skill. */
  ladder: readonly SkillHint[];
}

export function hintFor(subject: Subject, skillId: string): Hint | null {
  const plan = SUBJECTS[subject];
  const ladder = hintsForSkill(skillId, plan.misconceptions, plan.strategies);
  const top = ladder[0];
  if (!top) return null;
  return {
    skillId,
    level: 1,
    misconceptionId: top.misconceptionId,
    strategyId: top.strategyId,
    message: top.intent,
    representations: top.representations,
    ladder,
  };
}

/**
 * Session-scoped summary (the wrap-up): what the child did THIS session (observed
 * evidence) kept separate from derived mastery (cumulative, re-computed), plus the
 * planner's plain-language rationale. Never a predicted grade (PAR-001/002/003).
 * Caller does auth / tenant isolation; this reads the ledger only.
 */
export interface SessionSummary {
  sessionId: string;
  subject: string;
  state: string;
  observed: {
    attempts: number;
    correct: number;
    bySkill: { skillId: string; attempts: number; correct: number; representations: string[] }[];
  };
  mastery: { skillId: string; projection: SkillProjection }[];
  rationale: ReportRationale;
  note: string;
}

export async function buildSessionSummary(
  deps: Deps,
  alias: string,
  sessionId: string,
): Promise<SessionSummary> {
  const row = await deps.session.getTutoringSession(sessionId);
  if (!row || row.learnerAlias !== alias) {
    throw new DomainError('NOT_FOUND', 'session not found');
  }

  const prefix = `${sessionId}:`;
  const sessionEvidence = (await deps.evidence.listEvidenceForLearner(alias)).filter((e) =>
    e.eventId.startsWith(prefix),
  );
  const skillIds = [...new Set(sessionEvidence.map((e) => e.skillId))];

  const observedBySkill = skillIds.map((skillId) => {
    const items = sessionEvidence.filter((e) => e.skillId === skillId);
    return {
      skillId,
      attempts: items.length,
      correct: items.filter((e) => e.correct).length,
      representations: [...new Set(items.map((e) => e.representation))],
    };
  });

  // Derived mastery (cumulative) — ER-03 gated, never hand-set.
  assertMasteryPolicyApproved(deps.policies.mastery, deps.policies.isProd);
  const mastery: { skillId: string; projection: SkillProjection }[] = [];
  for (const skillId of skillIds) {
    mastery.push({ skillId, projection: await projectSkill(deps, alias, skillId) });
  }

  const rationale = await buildReportRationale(deps, alias, skillIds, row.subject as Subject);

  return {
    sessionId,
    subject: row.subject,
    state: row.state,
    observed: {
      attempts: sessionEvidence.length,
      correct: sessionEvidence.filter((e) => e.correct).length,
      bySkill: observedBySkill,
    },
    mastery,
    rationale,
    note: 'Observed = this session only; mastery = cumulative derived state, not a predicted grade. Rationale explains the engine’s skill choices; it is not a prediction or diagnosis.',
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
