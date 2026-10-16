import {
  projectShadow,
  assertMasteryPolicyApproved,
  type SkillProjection,
} from '@potenova/learner-state';
import { DomainError } from '@potenova/contracts';
import {
  buildFractionsDraftGraph,
  buildEnglishDraftGraph,
  buildAdditionDraftGraph,
  hintsForSkill,
  FRACTION_MISCONCEPTIONS,
  FRACTION_STRATEGIES,
  ENGLISH_MISCONCEPTIONS,
  ENGLISH_STRATEGIES,
  ADDITION_MISCONCEPTIONS,
  ADDITION_STRATEGIES,
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
 * SUBJECT/STRAND-AGNOSTIC: each COURSE (a strand within a subject) supplies its
 * own graph, oracle-validatable coachable skills, default tasks and remediation-
 * representation ladder. The planner/stall/selection code is identical across
 * every course — that is what shows the engine is not fractions-only (or
 * Math-only). A subject can hold several courses (Math = fractions + addition);
 * a session is pinned to one course via the subject's default or an explicit
 * strand. Skill ids are CANONICAL curriculum ids.
 */

export type Subject = 'math' | 'english';
export type CourseId = 'fractions' | 'addition' | 'plurals';

interface CoursePlan {
  readonly subject: Subject;
  readonly buildGraph: () => CurriculumGraph;
  /** Oracle-validatable skills the slice can coach, in canonical order. */
  readonly coachableSkillIds: readonly string[];
  /** The task offered first when the planner selects a skill. */
  readonly defaultTask: Readonly<Record<string, string>>;
  /** Varied practice items per skill (first === defaultTask). The served item
   *  rotates by how many items the learner has already worked for that skill in
   *  the session, so repeat coaching shows fresh problems (presentational only —
   *  mastery stays representation-driven, never item-count driven). */
  readonly practiceTasks: Readonly<Record<string, readonly string[]>>;
  /** Strategy-change representation ladder (first = most concrete). */
  readonly remediationReps: readonly string[];
  /** Misconception KB for the hint ladder (empty when a course has none yet). */
  readonly misconceptions: readonly MisconceptionDefinition[];
  readonly strategies: readonly InstructionalStrategy[];
  /** The transfer (novel-context) task offered when a mastered skill earns one. */
  readonly transferTask: Readonly<Record<string, string>>;
}

const COURSES: Record<CourseId, CoursePlan> = {
  fractions: {
    subject: 'math',
    buildGraph: buildFractionsDraftGraph,
    coachableSkillIds: ['SK-FR-equiv', 'SK-FR-compare'],
    defaultTask: { 'SK-FR-compare': 'frac-cmp-1', 'SK-FR-equiv': 'frac-eq-1' },
    practiceTasks: {
      'SK-FR-equiv': ['frac-eq-1', 'frac-eq-2', 'frac-eq-3', 'frac-eq-4'],
      'SK-FR-compare': ['frac-cmp-1', 'frac-cmp-2', 'frac-cmp-3', 'frac-cmp-4'],
    },
    remediationReps: ['area-model', 'number-line', 'set', 'symbolic'],
    misconceptions: FRACTION_MISCONCEPTIONS,
    strategies: FRACTION_STRATEGIES,
    transferTask: { 'SK-FR-compare': 'frac-xfer-cmp', 'SK-FR-equiv': 'frac-xfer-eq' },
  },
  addition: {
    subject: 'math',
    buildGraph: buildAdditionDraftGraph,
    coachableSkillIds: ['SK-NS-add-within10', 'SK-NS-add-within20'],
    defaultTask: { 'SK-NS-add-within10': 'add-10-1', 'SK-NS-add-within20': 'add-20-1' },
    practiceTasks: {
      'SK-NS-add-within10': ['add-10-1', 'add-10-2', 'add-10-3', 'add-10-4'],
      'SK-NS-add-within20': ['add-20-1', 'add-20-2', 'add-20-3', 'add-20-4'],
    },
    remediationReps: ['counters', 'number-line', 'symbolic'],
    misconceptions: ADDITION_MISCONCEPTIONS,
    strategies: ADDITION_STRATEGIES,
    transferTask: { 'SK-NS-add-within10': 'add-xfer-10', 'SK-NS-add-within20': 'add-xfer-20' },
  },
  plurals: {
    subject: 'english',
    buildGraph: buildEnglishDraftGraph,
    coachableSkillIds: ['SK-EN-plural-base', 'SK-EN-plural-sibilant'],
    defaultTask: { 'SK-EN-plural-base': 'eng-base-1', 'SK-EN-plural-sibilant': 'eng-sib-1' },
    practiceTasks: {
      'SK-EN-plural-base': ['eng-base-1', 'eng-base-2', 'eng-base-3', 'eng-base-4'],
      'SK-EN-plural-sibilant': ['eng-sib-1', 'eng-sib-2', 'eng-sib-3', 'eng-sib-4'],
    },
    remediationReps: ['spoken', 'picture', 'written'],
    misconceptions: ENGLISH_MISCONCEPTIONS,
    strategies: ENGLISH_STRATEGIES,
    transferTask: { 'SK-EN-plural-base': 'eng-xfer-base', 'SK-EN-plural-sibilant': 'eng-xfer-sib' },
  },
};

/** The default course for each subject (preserves single-strand behaviour). */
export const DEFAULT_COURSE: Record<Subject, CourseId> = { math: 'fractions', english: 'plurals' };
/** Courses a subject offers, for the parent strand-focus control. */
export const COURSES_BY_SUBJECT: Record<Subject, CourseId[]> = {
  math: ['fractions', 'addition'],
  english: ['plurals'],
};

/** Resolve the course a session runs: an explicit, subject-valid strand or the default. */
export function courseFor(subject: Subject, strand?: string | null): CourseId {
  if (strand && (COURSES_BY_SUBJECT[subject] as string[]).includes(strand)) {
    return strand as CourseId;
  }
  return DEFAULT_COURSE[subject];
}
export function subjectOfCourse(course: CourseId): Subject {
  return COURSES[course].subject;
}
/** The oracle-coachable skills of a course (the placement/plan target set). */
export function courseCoachableSkills(course: CourseId): readonly string[] {
  return COURSES[course].coachableSkillIds;
}
/** The course's curriculum graph (for diagnostic placement planning). */
export function courseGraph(course: CourseId): CurriculumGraph {
  return COURSES[course].buildGraph();
}
export function defaultTaskId(course: CourseId, skillId: string): string | null {
  return COURSES[course].defaultTask[skillId] ?? null;
}
/** A probe/practice item for a skill, rotated by variant so repeated probes of
 *  the same skill use different items (diagnostic variety). */
export function probeTaskId(course: CourseId, skillId: string, variant: number): string | null {
  const pool = COURSES[course].practiceTasks[skillId] ?? [];
  if (pool.length === 0) return COURSES[course].defaultTask[skillId] ?? null;
  return pool[Math.abs(variant) % pool.length];
}

/** The subject a canonical skill belongs to (via its course graph), or null. */
export function subjectOfSkill(skillId: string): Subject | null {
  for (const course of Object.keys(COURSES) as CourseId[]) {
    try {
      COURSES[course].buildGraph().getSkill(skillId);
      return COURSES[course].subject;
    } catch {
      // not in this course's graph — try the next
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
  course: CourseId,
): Promise<boolean> {
  for (const skillId of COURSES[course].coachableSkillIds) {
    const p = await projectSkill(deps, alias, skillId);
    if (!MASTERED_STATES.has(p.state)) return false;
  }
  return true;
}

/**
 * A mastery snapshot of every coachable skill in a course (for the planner),
 * including each skill's most recent trusted practice time for retention/review.
 */
async function coachableMastery(
  deps: Deps,
  alias: string,
  course: CourseId,
): Promise<Record<string, SkillMastery>> {
  const mastery: Record<string, SkillMastery> = {};
  for (const skillId of COURSES[course].coachableSkillIds) {
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

/** How many items the learner has already worked for a skill IN THIS session
 *  (evidence event ids are `${sessionId}:${clientSubmissionId}`). Used to rotate
 *  the served practice item so repeat coaching shows fresh problems. */
async function sessionItemsForSkill(
  deps: Deps,
  alias: string,
  skillId: string,
  sessionId: string,
): Promise<number> {
  const events = await deps.evidence.listEvidence(alias, skillId);
  const prefix = `${sessionId}:`;
  return events.filter((e) => e.eventId.startsWith(prefix)).length;
}

/** Ask the planner what to coach next off the current derived mastery. When a
 *  sessionId is given, the served practice item rotates with prior in-session
 *  attempts for the chosen skill (richer content); without one it is item 0. */
export async function computeNext(
  deps: Deps,
  alias: string,
  course: CourseId,
  opts?: { sessionId?: string; parentPreferredSkillIds?: readonly string[] },
): Promise<NextRecommendation> {
  const plan = COURSES[course];
  const mastery = await coachableMastery(deps, alias, course);
  const next = selectNextObjective({
    graph: plan.buildGraph(),
    coachableSkillIds: plan.coachableSkillIds,
    mastery,
    policy: DRAFT_PLANNER_POLICY,
    parentPreferredSkillIds: opts?.parentPreferredSkillIds,
  });
  // A transfer check points at the novel-context task; otherwise a practice item
  // from the skill's pool, rotated by prior in-session attempts.
  let defaultTaskId: string | null;
  if (next.reasonCode === 'TRANSFER_CHECK') {
    defaultTaskId =
      plan.transferTask[next.targetSkillId] ?? plan.defaultTask[next.targetSkillId] ?? null;
  } else {
    const pool = plan.practiceTasks[next.targetSkillId] ?? [];
    const idx =
      opts?.sessionId && pool.length > 0
        ? (await sessionItemsForSkill(deps, alias, next.targetSkillId, opts.sessionId)) %
          pool.length
        : 0;
    defaultTaskId = pool[idx] ?? plan.defaultTask[next.targetSkillId] ?? null;
  }
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
  course: CourseId,
): Promise<ReportRationale> {
  const plan = COURSES[course];
  const mastery = await coachableMastery(deps, alias, course);
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
        : 'Not part of the current adaptive plan for this course.',
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

export function hintFor(course: CourseId, skillId: string): Hint | null {
  const plan = COURSES[course];
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

  const course = courseFor(row.subject as Subject, row.strand);
  const rationale = await buildReportRationale(deps, alias, skillIds, course);

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
  course: CourseId,
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

  const plan = COURSES[course];
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
