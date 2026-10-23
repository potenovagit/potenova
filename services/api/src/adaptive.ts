import {
  projectShadow,
  assertMasteryPolicyApproved,
  conceptualEvidenceFromLedger,
  evaluateConceptualMastery,
  evaluateAssessedCoreMastery,
  ER03_CANDIDATE_V02,
  type SkillProjection,
  type ConceptualMasteryResult,
} from '@potenova/learner-state';
import { DomainError } from '@potenova/contracts';
import {
  buildFractionsDraftGraph,
  buildEnglishDraftGraph,
  buildAdditionDraftGraph,
  buildSubtractionDraftGraph,
  buildWholeNumberDraftGraph,
  buildSkipCountDraftGraph,
  buildAlgebraEquivDraftGraph,
  buildPlaceValueDraftGraph,
  buildFinancialDraftGraph,
  buildNumberRepDraftGraph,
  buildSpatialDraftGraph,
  buildDataHandlingDraftGraph,
  buildGeometryDraftGraph,
  buildCalendarDraftGraph,
  buildEstimationDraftGraph,
  buildDateCalendarDraftGraph,
  buildCodingDraftGraph,
  buildWordProblemsDraftGraph,
  buildConstructionDraftGraph,
  buildWholeNumberG2DraftGraph,
  buildSubtractionG2DraftGraph,
  buildSkipCountG2DraftGraph,
  buildEvenOddDraftGraph,
  buildMoney100DraftGraph,
  buildWordProblemsG2DraftGraph,
  buildEstimationG2DraftGraph,
  hintsForSkill,
  FRACTION_MISCONCEPTIONS,
  FRACTION_STRATEGIES,
  ENGLISH_MISCONCEPTIONS,
  ENGLISH_STRATEGIES,
  ADDITION_MISCONCEPTIONS,
  ADDITION_STRATEGIES,
  SUBTRACTION_MISCONCEPTIONS,
  SUBTRACTION_STRATEGIES,
  WHOLE_NUMBER_MISCONCEPTIONS,
  WHOLE_NUMBER_STRATEGIES,
  SKIP_COUNT_MISCONCEPTIONS,
  SKIP_COUNT_STRATEGIES,
  ALGEBRA_EQUIV_MISCONCEPTIONS,
  ALGEBRA_EQUIV_STRATEGIES,
  PLACE_VALUE_MISCONCEPTIONS,
  PLACE_VALUE_STRATEGIES,
  FINANCIAL_MISCONCEPTIONS,
  FINANCIAL_STRATEGIES,
  NUMBER_REP_MISCONCEPTIONS,
  NUMBER_REP_STRATEGIES,
  SPATIAL_MISCONCEPTIONS,
  SPATIAL_STRATEGIES,
  DATA_MISCONCEPTIONS,
  DATA_STRATEGIES,
  GEOMETRY_MISCONCEPTIONS,
  GEOMETRY_STRATEGIES,
  CALENDAR_MISCONCEPTIONS,
  CALENDAR_STRATEGIES,
  ESTIMATION_MISCONCEPTIONS,
  ESTIMATION_STRATEGIES,
  DATE_CALENDAR_MISCONCEPTIONS,
  DATE_CALENDAR_STRATEGIES,
  CODING_MISCONCEPTIONS,
  CODING_STRATEGIES,
  WORD_PROBLEM_MISCONCEPTIONS,
  WORD_PROBLEM_STRATEGIES,
  CONSTRUCTION_MISCONCEPTIONS,
  CONSTRUCTION_STRATEGIES,
  WHOLE_NUMBER_G2_MISCONCEPTIONS,
  WHOLE_NUMBER_G2_STRATEGIES,
  SUBTRACTION_G2_MISCONCEPTIONS,
  SUBTRACTION_G2_STRATEGIES,
  SKIP_COUNT_G2_MISCONCEPTIONS,
  SKIP_COUNT_G2_STRATEGIES,
  EVEN_ODD_MISCONCEPTIONS,
  EVEN_ODD_STRATEGIES,
  MONEY_100_MISCONCEPTIONS,
  MONEY_100_STRATEGIES,
  WORD_PROBLEMS_G2_MISCONCEPTIONS,
  WORD_PROBLEMS_G2_STRATEGIES,
  ESTIMATION_G2_MISCONCEPTIONS,
  ESTIMATION_G2_STRATEGIES,
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
export type CourseId =
  | 'fractions'
  | 'addition'
  | 'subtraction'
  | 'whole-number'
  | 'skip-count'
  | 'algebra-equiv'
  | 'place-value'
  | 'financial'
  | 'number-rep'
  | 'spatial'
  | 'data-handling'
  | 'geometry'
  | 'calendar'
  | 'estimation'
  | 'date-calendar'
  | 'coding'
  | 'word-problems'
  | 'construction'
  | 'whole-number-g2'
  | 'subtraction-g2'
  | 'skip-count-g2'
  | 'even-odd'
  | 'money-100'
  | 'word-problems-g2'
  | 'estimation-g2'
  | 'plurals'
  | 'past-tense'
  | 'comparative';

/** Fixed seed for a generated-only course's default/practice items: the planner
 *  and diagnostic reference stable generated task ids, resolved deterministically
 *  by the task layer (gen:<skill>:<seed>:core:<index>). */
const GEN_COURSE_SEED = 7;
const genCourseTask = (skillId: string, index: number): string =>
  `gen:${skillId}:${GEN_COURSE_SEED}:core:${index}`;
/** A generated-course transfer probe: a novel-context (stretch) item the loop grades
 *  as transfer_check, so a generated-only skill can reach TRANSFERABLE (AT-12). */
const genTransferTask = (skillId: string): string => `gen:${skillId}:${GEN_COURSE_SEED}:transfer:0`;

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
    // Full pilot progression, in teaching order. Prerequisite gating follows the
    // approved DRAFT graph edges (partition→unit→non-unit→…→equiv→compare; order
    // and number-line sit off the hard/strong path). The five skills added here
    // are served from the deterministic generator (no static bank). Final
    // ordering/mastery remains educator-gated (ER-03).
    coachableSkillIds: [
      'SK-FR-partition',
      'SK-FR-unit',
      'SK-FR-nonunit',
      'SK-FR-numberline',
      'SK-FR-equiv',
      'SK-FR-compare',
      'SK-FR-order',
    ],
    defaultTask: {
      'SK-FR-partition': genCourseTask('SK-FR-partition', 0),
      'SK-FR-unit': genCourseTask('SK-FR-unit', 0),
      'SK-FR-nonunit': genCourseTask('SK-FR-nonunit', 0),
      'SK-FR-numberline': genCourseTask('SK-FR-numberline', 0),
      'SK-FR-equiv': 'frac-eq-1',
      'SK-FR-compare': 'frac-cmp-1',
      'SK-FR-order': genCourseTask('SK-FR-order', 0),
    },
    practiceTasks: {
      'SK-FR-partition': [0, 1, 2, 3].map((i) => genCourseTask('SK-FR-partition', i)),
      'SK-FR-unit': [0, 1, 2, 3].map((i) => genCourseTask('SK-FR-unit', i)),
      'SK-FR-nonunit': [0, 1, 2, 3].map((i) => genCourseTask('SK-FR-nonunit', i)),
      'SK-FR-numberline': [0, 1, 2, 3].map((i) => genCourseTask('SK-FR-numberline', i)),
      'SK-FR-equiv': ['frac-eq-1', 'frac-eq-2', 'frac-eq-3', 'frac-eq-4'],
      'SK-FR-compare': ['frac-cmp-1', 'frac-cmp-2', 'frac-cmp-3', 'frac-cmp-4'],
      'SK-FR-order': [0, 1, 2, 3].map((i) => genCourseTask('SK-FR-order', i)),
    },
    remediationReps: ['area-model', 'number-line', 'set', 'symbolic'],
    misconceptions: FRACTION_MISCONCEPTIONS,
    strategies: FRACTION_STRATEGIES,
    transferTask: {
      'SK-FR-partition': genTransferTask('SK-FR-partition'),
      'SK-FR-unit': genTransferTask('SK-FR-unit'),
      'SK-FR-nonunit': genTransferTask('SK-FR-nonunit'),
      'SK-FR-numberline': genTransferTask('SK-FR-numberline'),
      'SK-FR-equiv': 'frac-xfer-eq',
      'SK-FR-compare': 'frac-xfer-cmp',
      'SK-FR-order': genTransferTask('SK-FR-order'),
    },
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
  subtraction: {
    subject: 'math',
    buildGraph: buildSubtractionDraftGraph,
    coachableSkillIds: ['SK-NS-sub-within10', 'SK-NS-sub-within20'],
    defaultTask: { 'SK-NS-sub-within10': 'sub-10-1', 'SK-NS-sub-within20': 'sub-20-1' },
    practiceTasks: {
      'SK-NS-sub-within10': ['sub-10-1', 'sub-10-2', 'sub-10-3', 'sub-10-4'],
      'SK-NS-sub-within20': ['sub-20-1', 'sub-20-2', 'sub-20-3', 'sub-20-4'],
    },
    remediationReps: ['counters', 'number-line', 'symbolic'],
    misconceptions: SUBTRACTION_MISCONCEPTIONS,
    strategies: SUBTRACTION_STRATEGIES,
    transferTask: { 'SK-NS-sub-within10': 'sub-xfer-10', 'SK-NS-sub-within20': 'sub-xfer-20' },
  },
  'whole-number': {
    subject: 'math',
    buildGraph: buildWholeNumberDraftGraph,
    coachableSkillIds: ['SK-NS-compare-whole-50', 'SK-NS-order-whole-50'],
    defaultTask: { 'SK-NS-compare-whole-50': 'cmpw-1', 'SK-NS-order-whole-50': 'ordw-1' },
    practiceTasks: {
      'SK-NS-compare-whole-50': ['cmpw-1', 'cmpw-2', 'cmpw-3', 'cmpw-4'],
      'SK-NS-order-whole-50': ['ordw-1', 'ordw-2', 'ordw-3', 'ordw-4'],
    },
    remediationReps: ['counters', 'number-line', 'symbolic'],
    misconceptions: WHOLE_NUMBER_MISCONCEPTIONS,
    strategies: WHOLE_NUMBER_STRATEGIES,
    transferTask: {
      'SK-NS-compare-whole-50': 'cmpw-xfer',
      'SK-NS-order-whole-50': 'ordw-xfer',
    },
  },
  'skip-count': {
    subject: 'math',
    buildGraph: buildSkipCountDraftGraph,
    coachableSkillIds: ['SK-NS-skip-count-50'],
    defaultTask: { 'SK-NS-skip-count-50': 'skip-1' },
    practiceTasks: {
      'SK-NS-skip-count-50': ['skip-1', 'skip-2', 'skip-3', 'skip-4'],
    },
    remediationReps: ['counters', 'number-line', 'symbolic'],
    misconceptions: SKIP_COUNT_MISCONCEPTIONS,
    strategies: SKIP_COUNT_STRATEGIES,
    transferTask: { 'SK-NS-skip-count-50': 'skip-xfer' },
  },
  'algebra-equiv': {
    subject: 'math',
    buildGraph: buildAlgebraEquivDraftGraph,
    coachableSkillIds: ['SK-AL-equiv-expr'],
    defaultTask: { 'SK-AL-equiv-expr': 'equiv-1' },
    practiceTasks: {
      'SK-AL-equiv-expr': ['equiv-1', 'equiv-2', 'equiv-3', 'equiv-4'],
    },
    remediationReps: ['counters', 'symbolic'],
    misconceptions: ALGEBRA_EQUIV_MISCONCEPTIONS,
    strategies: ALGEBRA_EQUIV_STRATEGIES,
    transferTask: { 'SK-AL-equiv-expr': 'equiv-xfer' },
  },
  'place-value': {
    subject: 'math',
    buildGraph: buildPlaceValueDraftGraph,
    coachableSkillIds: ['SK-NS-compose-50'],
    defaultTask: { 'SK-NS-compose-50': 'compose-1' },
    practiceTasks: {
      'SK-NS-compose-50': ['compose-1', 'compose-2', 'compose-3', 'compose-4'],
    },
    remediationReps: ['counters', 'symbolic'],
    misconceptions: PLACE_VALUE_MISCONCEPTIONS,
    strategies: PLACE_VALUE_STRATEGIES,
    transferTask: { 'SK-NS-compose-50': 'compose-xfer' },
  },
  financial: {
    subject: 'math',
    buildGraph: buildFinancialDraftGraph,
    coachableSkillIds: ['SK-FIN-coin-value'],
    defaultTask: { 'SK-FIN-coin-value': 'coins-1' },
    practiceTasks: {
      'SK-FIN-coin-value': ['coins-1', 'coins-2', 'coins-3', 'coins-4'],
    },
    remediationReps: ['counters', 'symbolic'],
    misconceptions: FINANCIAL_MISCONCEPTIONS,
    strategies: FINANCIAL_STRATEGIES,
    transferTask: { 'SK-FIN-coin-value': 'coins-xfer' },
  },
  'number-rep': {
    subject: 'math',
    buildGraph: buildNumberRepDraftGraph,
    coachableSkillIds: ['SK-NS-represent-50'],
    defaultTask: { 'SK-NS-represent-50': 'rep-1' },
    practiceTasks: {
      'SK-NS-represent-50': ['rep-1', 'rep-2', 'rep-3', 'rep-4'],
    },
    remediationReps: ['counters', 'symbolic'],
    misconceptions: NUMBER_REP_MISCONCEPTIONS,
    strategies: NUMBER_REP_STRATEGIES,
    transferTask: { 'SK-NS-represent-50': 'rep-xfer' },
  },
  spatial: {
    subject: 'math',
    buildGraph: buildSpatialDraftGraph,
    coachableSkillIds: ['SK-GEO-positional-language'],
    defaultTask: { 'SK-GEO-positional-language': 'pos-1' },
    practiceTasks: {
      'SK-GEO-positional-language': ['pos-1', 'pos-2', 'pos-3', 'pos-4'],
    },
    remediationReps: ['counters', 'symbolic'],
    misconceptions: SPATIAL_MISCONCEPTIONS,
    strategies: SPATIAL_STRATEGIES,
    transferTask: { 'SK-GEO-positional-language': 'pos-xfer' },
  },
  'data-handling': {
    subject: 'math',
    buildGraph: buildDataHandlingDraftGraph,
    coachableSkillIds: ['SK-DATA-interpret-graph'],
    defaultTask: { 'SK-DATA-interpret-graph': 'data-1' },
    practiceTasks: {
      'SK-DATA-interpret-graph': ['data-1', 'data-2', 'data-3', 'data-4'],
    },
    remediationReps: ['counters', 'symbolic'],
    misconceptions: DATA_MISCONCEPTIONS,
    strategies: DATA_STRATEGIES,
    transferTask: { 'SK-DATA-interpret-graph': 'data-xfer' },
  },
  geometry: {
    subject: 'math',
    buildGraph: buildGeometryDraftGraph,
    coachableSkillIds: ['SK-GEO-shape-attribute'],
    defaultTask: { 'SK-GEO-shape-attribute': 'shape-1' },
    practiceTasks: {
      'SK-GEO-shape-attribute': ['shape-1', 'shape-2', 'shape-3', 'shape-4'],
    },
    remediationReps: ['counters', 'symbolic'],
    misconceptions: GEOMETRY_MISCONCEPTIONS,
    strategies: GEOMETRY_STRATEGIES,
    transferTask: { 'SK-GEO-shape-attribute': 'shape-xfer' },
  },
  calendar: {
    subject: 'math',
    buildGraph: buildCalendarDraftGraph,
    coachableSkillIds: ['SK-TIME-calendar-day'],
    defaultTask: { 'SK-TIME-calendar-day': 'cal-1' },
    practiceTasks: {
      'SK-TIME-calendar-day': ['cal-1', 'cal-2', 'cal-3', 'cal-4'],
    },
    remediationReps: ['counters', 'symbolic'],
    misconceptions: CALENDAR_MISCONCEPTIONS,
    strategies: CALENDAR_STRATEGIES,
    transferTask: { 'SK-TIME-calendar-day': 'cal-xfer' },
  },
  estimation: {
    subject: 'math',
    buildGraph: buildEstimationDraftGraph,
    coachableSkillIds: ['SK-NS-estimate-50'],
    defaultTask: { 'SK-NS-estimate-50': 'est-1' },
    practiceTasks: {
      'SK-NS-estimate-50': ['est-1', 'est-2', 'est-3', 'est-4'],
    },
    remediationReps: ['counters', 'symbolic'],
    misconceptions: ESTIMATION_MISCONCEPTIONS,
    strategies: ESTIMATION_STRATEGIES,
    transferTask: { 'SK-NS-estimate-50': 'est-xfer' },
  },
  'date-calendar': {
    subject: 'math',
    buildGraph: buildDateCalendarDraftGraph,
    coachableSkillIds: ['SK-TIME-date-offset'],
    defaultTask: { 'SK-TIME-date-offset': 'date-1' },
    practiceTasks: {
      'SK-TIME-date-offset': ['date-1', 'date-2', 'date-3', 'date-4'],
    },
    remediationReps: ['counters', 'symbolic'],
    misconceptions: DATE_CALENDAR_MISCONCEPTIONS,
    strategies: DATE_CALENDAR_STRATEGIES,
    transferTask: { 'SK-TIME-date-offset': 'date-xfer' },
  },
  coding: {
    subject: 'math',
    buildGraph: buildCodingDraftGraph,
    coachableSkillIds: ['SK-AL-code-sequence'],
    defaultTask: { 'SK-AL-code-sequence': 'code-1' },
    practiceTasks: {
      'SK-AL-code-sequence': ['code-1', 'code-2', 'code-3', 'code-4'],
    },
    remediationReps: ['counters', 'symbolic'],
    misconceptions: CODING_MISCONCEPTIONS,
    strategies: CODING_STRATEGIES,
    transferTask: { 'SK-AL-code-sequence': 'code-xfer' },
  },
  'word-problems': {
    subject: 'math',
    buildGraph: buildWordProblemsDraftGraph,
    coachableSkillIds: ['SK-NS-word-problem-addsub'],
    defaultTask: { 'SK-NS-word-problem-addsub': 'wp-1' },
    practiceTasks: {
      'SK-NS-word-problem-addsub': ['wp-1', 'wp-2', 'wp-3', 'wp-4'],
    },
    remediationReps: ['counters', 'symbolic'],
    misconceptions: WORD_PROBLEM_MISCONCEPTIONS,
    strategies: WORD_PROBLEM_STRATEGIES,
    transferTask: { 'SK-NS-word-problem-addsub': 'wp-xfer' },
  },
  construction: {
    subject: 'math',
    buildGraph: buildConstructionDraftGraph,
    coachableSkillIds: ['SK-NS-build-number'],
    defaultTask: { 'SK-NS-build-number': 'build-1' },
    practiceTasks: {
      'SK-NS-build-number': ['build-1', 'build-2', 'build-3', 'build-4'],
    },
    remediationReps: ['counters', 'symbolic'],
    misconceptions: CONSTRUCTION_MISCONCEPTIONS,
    strategies: CONSTRUCTION_STRATEGIES,
    transferTask: { 'SK-NS-build-number': 'build-xfer' },
  },
  'whole-number-g2': {
    subject: 'math',
    buildGraph: buildWholeNumberG2DraftGraph,
    coachableSkillIds: ['SK-NS-compare-whole-200', 'SK-NS-order-whole-200'],
    defaultTask: {
      'SK-NS-compare-whole-200': 'cmpw2-1',
      'SK-NS-order-whole-200': 'ordw2-1',
    },
    practiceTasks: {
      'SK-NS-compare-whole-200': ['cmpw2-1', 'cmpw2-2', 'cmpw2-3', 'cmpw2-4'],
      'SK-NS-order-whole-200': ['ordw2-1', 'ordw2-2', 'ordw2-3', 'ordw2-4'],
    },
    remediationReps: ['counters', 'number-line', 'symbolic'],
    misconceptions: WHOLE_NUMBER_G2_MISCONCEPTIONS,
    strategies: WHOLE_NUMBER_G2_STRATEGIES,
    transferTask: {
      'SK-NS-compare-whole-200': 'cmpw2-xfer',
      'SK-NS-order-whole-200': 'ordw2-xfer',
    },
  },
  'subtraction-g2': {
    subject: 'math',
    buildGraph: buildSubtractionG2DraftGraph,
    coachableSkillIds: ['SK-NS-sub-within100'],
    defaultTask: { 'SK-NS-sub-within100': 'sub100-1' },
    practiceTasks: {
      'SK-NS-sub-within100': ['sub100-1', 'sub100-2', 'sub100-3', 'sub100-4'],
    },
    remediationReps: ['counters', 'number-line', 'symbolic'],
    misconceptions: SUBTRACTION_G2_MISCONCEPTIONS,
    strategies: SUBTRACTION_G2_STRATEGIES,
    transferTask: { 'SK-NS-sub-within100': 'sub100-xfer' },
  },
  'skip-count-g2': {
    subject: 'math',
    buildGraph: buildSkipCountG2DraftGraph,
    coachableSkillIds: ['SK-NS-skip-count-200'],
    defaultTask: { 'SK-NS-skip-count-200': 'skip2-1' },
    practiceTasks: {
      'SK-NS-skip-count-200': ['skip2-1', 'skip2-2', 'skip2-3', 'skip2-4'],
    },
    remediationReps: ['counters', 'number-line', 'symbolic'],
    misconceptions: SKIP_COUNT_G2_MISCONCEPTIONS,
    strategies: SKIP_COUNT_G2_STRATEGIES,
    transferTask: { 'SK-NS-skip-count-200': 'skip2-xfer' },
  },
  'even-odd': {
    subject: 'math',
    buildGraph: buildEvenOddDraftGraph,
    coachableSkillIds: ['SK-NS-even-odd'],
    defaultTask: { 'SK-NS-even-odd': 'parity-1' },
    practiceTasks: {
      'SK-NS-even-odd': ['parity-1', 'parity-2', 'parity-3', 'parity-4'],
    },
    remediationReps: ['counters', 'symbolic'],
    misconceptions: EVEN_ODD_MISCONCEPTIONS,
    strategies: EVEN_ODD_STRATEGIES,
    transferTask: { 'SK-NS-even-odd': 'parity-xfer' },
  },
  'money-100': {
    subject: 'math',
    buildGraph: buildMoney100DraftGraph,
    coachableSkillIds: ['SK-FIN-money-100'],
    defaultTask: { 'SK-FIN-money-100': 'money100-1' },
    practiceTasks: {
      'SK-FIN-money-100': ['money100-1', 'money100-2', 'money100-3', 'money100-4'],
    },
    remediationReps: ['counters', 'symbolic'],
    misconceptions: MONEY_100_MISCONCEPTIONS,
    strategies: MONEY_100_STRATEGIES,
    transferTask: { 'SK-FIN-money-100': 'money100-xfer' },
  },
  'word-problems-g2': {
    subject: 'math',
    buildGraph: buildWordProblemsG2DraftGraph,
    coachableSkillIds: ['SK-NS-word-problem-addsub-100'],
    defaultTask: { 'SK-NS-word-problem-addsub-100': 'wp100-1' },
    practiceTasks: {
      'SK-NS-word-problem-addsub-100': ['wp100-1', 'wp100-2', 'wp100-3', 'wp100-4'],
    },
    remediationReps: ['counters', 'symbolic'],
    misconceptions: WORD_PROBLEMS_G2_MISCONCEPTIONS,
    strategies: WORD_PROBLEMS_G2_STRATEGIES,
    transferTask: { 'SK-NS-word-problem-addsub-100': 'wp100-xfer' },
  },
  'estimation-g2': {
    subject: 'math',
    buildGraph: buildEstimationG2DraftGraph,
    coachableSkillIds: ['SK-NS-estimate-200'],
    defaultTask: { 'SK-NS-estimate-200': 'est200-1' },
    practiceTasks: {
      'SK-NS-estimate-200': ['est200-1', 'est200-2', 'est200-3', 'est200-4'],
    },
    remediationReps: ['counters', 'symbolic'],
    misconceptions: ESTIMATION_G2_MISCONCEPTIONS,
    strategies: ESTIMATION_G2_STRATEGIES,
    transferTask: { 'SK-NS-estimate-200': 'est200-xfer' },
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
  // Generated-only English courses: items come from the deterministic generator
  // (no static bank), referenced here as stable generated task ids.
  'past-tense': {
    subject: 'english',
    buildGraph: buildEnglishDraftGraph,
    coachableSkillIds: ['SK-EN-past-regular'],
    defaultTask: { 'SK-EN-past-regular': genCourseTask('SK-EN-past-regular', 0) },
    practiceTasks: {
      'SK-EN-past-regular': [0, 1, 2, 3].map((i) => genCourseTask('SK-EN-past-regular', i)),
    },
    remediationReps: ['spoken', 'written'],
    misconceptions: [],
    strategies: ENGLISH_STRATEGIES,
    transferTask: { 'SK-EN-past-regular': genTransferTask('SK-EN-past-regular') },
  },
  comparative: {
    subject: 'english',
    buildGraph: buildEnglishDraftGraph,
    coachableSkillIds: ['SK-EN-comparative'],
    defaultTask: { 'SK-EN-comparative': genCourseTask('SK-EN-comparative', 0) },
    practiceTasks: {
      'SK-EN-comparative': [0, 1, 2, 3].map((i) => genCourseTask('SK-EN-comparative', i)),
    },
    remediationReps: ['spoken', 'written'],
    misconceptions: [],
    strategies: ENGLISH_STRATEGIES,
    transferTask: { 'SK-EN-comparative': genTransferTask('SK-EN-comparative') },
  },
};

/** The default course for each subject (preserves single-strand behaviour). */
export const DEFAULT_COURSE: Record<Subject, CourseId> = { math: 'fractions', english: 'plurals' };
/** Courses a subject offers, for the parent strand-focus control. */
export const COURSES_BY_SUBJECT: Record<Subject, CourseId[]> = {
  math: [
    'fractions',
    'addition',
    'subtraction',
    'whole-number',
    'skip-count',
    'algebra-equiv',
    'place-value',
    'financial',
    'number-rep',
    'spatial',
    'data-handling',
    'geometry',
    'calendar',
    'estimation',
    'date-calendar',
    'coding',
    'word-problems',
    'construction',
    'whole-number-g2',
    'subtraction-g2',
    'skip-count-g2',
    'even-odd',
    'money-100',
    'word-problems-g2',
    'estimation-g2',
  ],
  english: ['plurals', 'past-tense', 'comparative'],
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

/** The course that owns a skill (by coachable set, then graph membership). */
export function courseOfSkill(skillId: string): CourseId | null {
  for (const course of Object.keys(COURSES) as CourseId[]) {
    if ((COURSES[course].coachableSkillIds as readonly string[]).includes(skillId)) return course;
  }
  for (const course of Object.keys(COURSES) as CourseId[]) {
    try {
      COURSES[course].buildGraph().getSkill(skillId);
      return course;
    } catch {
      // not here
    }
  }
  return null;
}

/** The misconception ids the KB maps to a skill (authored). */
export function misconceptionIdsForSkill(course: CourseId, skillId: string): string[] {
  return COURSES[course].misconceptions
    .filter((m) => m.skillId === skillId)
    .map((m) => m.misconceptionId);
}

export interface LessonKey {
  misconceptionId: string | null;
  representation: string | null;
}

/**
 * Derive the teaching-library key for a skill SERVER-SIDE, so lesson selection
 * never depends on a client-supplied value (ADR-0021 follow-up).
 *
 * - misconception: the skill's authored misconception from the KB (the same top
 *   misconception the hint ladder surfaces). A client may pass one, but it is
 *   honoured only when it is a valid misconception for this skill; otherwise the
 *   KB value wins. There is no per-answer misconception classifier yet, so this
 *   is authoritative-by-KB, not inferred from the wrong answer.
 * - representation: the one the child most needs among the representations the
 *   authored remediation for that misconception teaches in — i.e. the candidate
 *   representation with the fewest CORRECT pieces of evidence (ties → the
 *   authored primary). With no evidence, the primary. This is a ranking signal
 *   only; it can never exclude the misconception's lesson, just pick among
 *   same-misconception variants.
 */
export function deriveLessonKey(
  course: CourseId,
  skillId: string,
  evidence: readonly { representation: string; correct: boolean }[],
  misconceptionOverride?: string | null,
): LessonKey {
  const hint = hintFor(course, skillId);
  if (!hint) return { misconceptionId: null, representation: null };

  const valid = misconceptionIdsForSkill(course, skillId);
  const misconceptionId =
    misconceptionOverride && valid.includes(misconceptionOverride)
      ? misconceptionOverride
      : hint.misconceptionId;

  // Representations the authored remediation for the CHOSEN misconception uses.
  const forChosen = hint.ladder.filter((h) => h.misconceptionId === misconceptionId);
  const candidateReps = [...new Set(forChosen.flatMap((h) => h.representations))];
  const reps = candidateReps.length > 0 ? candidateReps : [...hint.representations];
  if (reps.length === 0) return { misconceptionId, representation: null };

  const correctByRep = new Map<string, number>();
  for (const e of evidence) {
    if (e.correct)
      correctByRep.set(e.representation, (correctByRep.get(e.representation) ?? 0) + 1);
  }
  let weakest = reps[0];
  let weakestCount = correctByRep.get(weakest) ?? 0;
  for (const r of reps) {
    const c = correctByRep.get(r) ?? 0;
    if (c < weakestCount) {
      weakest = r;
      weakestCount = c;
    }
  }
  return { misconceptionId, representation: weakest };
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

/** The conceptual-mastery result, wrapped with the policy-approval status so the
 *  surface is honest about whether this is an approved or candidate claim. */
export interface ConceptualProjection {
  readonly result: ConceptualMasteryResult;
  /** The ER-03 conceptual policy is still a CANDIDATE — not an approved
   *  child-release rule, not an independent educator sign-off. Always false
   *  until a signed ER-03 approval replaces the candidate (Gate G2). */
  readonly policyApproved: boolean;
}

/**
 * Re-derive conceptual mastery (ER-03) for one assessed skill from the SAME
 * immutable ledger as `projectSkill` — a pure replay over persisted evidence +
 * corrections, never a separate store and never hand-set (TM-07/08). Only
 * conceptually-tagged events count; everything else is ignored.
 *
 * Fail-closed on grade: an assessed-core skill uses the grade-gated entry point,
 * so a grade-specific INDEPENDENT/RETAINED claim requires the learner's target
 * grade and grade-crossing evidence is excluded. The ER-03 policy is a CANDIDATE,
 * so `policyApproved` is false and this is an advisory projection — it must not
 * be presented as an approved mastery decision.
 */
export async function projectConceptual(
  deps: Deps,
  alias: string,
  skillId: string,
  gradeTarget: number,
): Promise<ConceptualProjection> {
  const policy = ER03_CANDIDATE_V02.skills[skillId];
  if (!policy) {
    throw new DomainError('NOT_FOUND', `no conceptual policy for skill ${skillId}`);
  }
  const events = await deps.evidence.listEvidence(alias, skillId);
  const corrections = await deps.evidence.listCorrections(events.map((e) => e.eventId));
  const conceptual = conceptualEvidenceFromLedger(events, corrections, skillId);
  const result =
    policy.role === 'assessed-core'
      ? evaluateAssessedCoreMastery(conceptual, policy, gradeTarget)
      : evaluateConceptualMastery(conceptual, policy, { gradeTarget });
  return { result, policyApproved: ER03_CANDIDATE_V02.approved };
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
      revalidationRequired: p.state === 'REVALIDATION_REQUIRED',
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
