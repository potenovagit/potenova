import { DomainError } from '@potenova/contracts';
import { decideDelivery, type CandidateContent } from '@potenova/domain-core';
import {
  checkMathTask,
  checkEnglishTask,
  checkAdditionTask,
  checkMultiplicationTask,
  checkDivisionTask,
  checkFractionalGroupsTask,
  fractionalGroupCount,
  checkSubtractionTask,
  checkWholeNumberTask,
  wholeRelation,
  type WholeRelation,
  checkSkipCountTask,
  skipCountNext,
  skipCountSequence,
  checkExprEquivalenceTask,
  evalExpr,
  type Expr,
  checkExprEquivalenceMulDivTask,
  evalExprMulDiv,
  type ExprMulDiv,
  checkComposeTask,
  composeValue,
  checkComposeHctoTask,
  composeHctoValue,
  checkCoinValueTask,
  coinTotalCents,
  checkRepresentationSelectTask,
  matchingRepresentationIndices,
  type RepresentationOption,
  checkPositionalSelectTask,
  matchingPositionalIndices,
  type PositionRelation,
  type PositionalScene,
  checkGraphReadSelectTask,
  extremeCategoryIndex,
  type GraphReadMode,
  type GraphCategory,
  checkShapeAttributeSelectTask,
  matchingShapeIndices,
  type ShapeOption,
  checkCalendarTask,
  dayAfter,
  checkEstimateTask,
  checkRoundWholeTask,
  roundToPlace,
  type RoundPlace,
  checkMultidigitMultiplicationTask,
  checkDivisionRemainderTask,
  checkDateOffsetSelectTask,
  addDays,
  matchingDateIndices,
  type CalendarDate,
  checkCodeReachSelectTask,
  reachingProgramIndices,
  type Move,
  type Cell,
  checkWordProblemTask,
  wordProblemResult,
  type WordOp,
  checkBuildNumberTask,
  checkParityTask,
  parityOf,
  type Parity,
  pluralize,
  pastTenseRegular,
  comparativeRegular,
  trueRelation,
  areEquivalent,
  validateCandidate,
  validationRecordRef,
  generateItems,
  generateEnglishItems,
  type Fraction,
  type FractionRelation,
  type Difficulty,
} from '@potenova/content';
import { type Subject } from './adaptive';

/**
 * The synthetic task bank and the pure, deterministic task layer shared by the
 * coaching loop and the diagnostic/placement path. No model generation anywhere
 * here: answer keys are validated and learner answers graded by the independent
 * oracles, so the same items can seed placement evidence and coach a child.
 * Skill ids are the CANONICAL curriculum ids so evidence, the graph and the
 * planner all agree.
 */

export const RELEASE_BY_SUBJECT: Record<Subject, string> = {
  math: 'REL-ONT-MATH-2020-draft',
  english: 'REL-ONT-LANG-2023-draft',
};
export const COMPARE = 'SK-FR-compare';
export const EQUIV = 'SK-FR-equiv';
export const PARTITION = 'SK-FR-partition';
export const UNIT = 'SK-FR-unit';
export const NONUNIT = 'SK-FR-nonunit';
export const NUMBERLINE = 'SK-FR-numberline';
export const ORDER = 'SK-FR-order';
export const PLURAL_BASE = 'SK-EN-plural-base';
export const PLURAL_SIB = 'SK-EN-plural-sibilant';
export const PAST = 'SK-EN-past-regular';
export const COMP = 'SK-EN-comparative';
export const ADD_10 = 'SK-NS-add-within10';
export const ADD_20 = 'SK-NS-add-within20';
export const MULT_FACTS = 'SK-NS-mult-facts';
export const DIV_FACTS = 'SK-NS-div-facts';
export const FRAC_GROUPS = 'SK-FR-groups';
export const SUB_10 = 'SK-NS-sub-within10';
export const SUB_20 = 'SK-NS-sub-within20';
export const SUB_100 = 'SK-NS-sub-within100';
export const CMP_WHOLE = 'SK-NS-compare-whole-50';
export const ORD_WHOLE = 'SK-NS-order-whole-50';
export const CMP_WHOLE_200 = 'SK-NS-compare-whole-200';
export const ORD_WHOLE_200 = 'SK-NS-order-whole-200';
export const SKIP_COUNT = 'SK-NS-skip-count-50';
export const SKIP_COUNT_200 = 'SK-NS-skip-count-200';
export const EQUIV_EXPR = 'SK-AL-equiv-expr';
export const EQUIV_EXPR_MULDIV = 'SK-AL-equiv-expr-muldiv';
export const COMPOSE_50 = 'SK-NS-compose-50';
export const COMPOSE_200 = 'SK-NS-compose-200';
export const COIN_VALUE = 'SK-FIN-coin-value';
export const MONEY_100 = 'SK-FIN-money-100';
export const REPRESENT_50 = 'SK-NS-represent-50';
export const POSITIONAL = 'SK-GEO-positional-language';
export const DATA_INTERPRET = 'SK-DATA-interpret-graph';
export const SHAPE_ATTR = 'SK-GEO-shape-attribute';
export const CALENDAR_DAY = 'SK-TIME-calendar-day';
export const ESTIMATE_50 = 'SK-NS-estimate-50';
export const ESTIMATE_200 = 'SK-NS-estimate-200';
export const ROUND_WHOLE = 'SK-NS-round-whole';
export const MULT_MULTIDIGIT = 'SK-NS-mult-multidigit';
export const DIV_REMAINDER = 'SK-NS-div-remainder';
export const DATE_OFFSET = 'SK-TIME-date-offset';
export const CODE_SEQUENCE = 'SK-AL-code-sequence';
export const WORD_PROBLEM = 'SK-NS-word-problem-addsub';
export const WORD_PROBLEM_100 = 'SK-NS-word-problem-addsub-100';
export const BUILD_NUMBER = 'SK-NS-build-number';
export const EVEN_ODD = 'SK-NS-even-odd';

interface CompareTask {
  readonly subject: 'math';
  readonly course: 'fractions';
  readonly skillId: typeof COMPARE;
  readonly kind: 'fraction_comparison';
  readonly left: Fraction;
  readonly right: Fraction;
}
interface EquivTask {
  readonly subject: 'math';
  readonly course: 'fractions';
  readonly skillId: typeof EQUIV;
  readonly kind: 'fraction_equivalence';
  readonly left: Fraction;
  readonly right: Fraction;
}
interface PluralTask {
  readonly subject: 'english';
  readonly course: 'plurals';
  readonly skillId: typeof PLURAL_BASE | typeof PLURAL_SIB;
  readonly kind: 'noun_plural';
  readonly word: string;
}
interface AdditionTask {
  readonly subject: 'math';
  readonly course: 'addition';
  readonly skillId: typeof ADD_10 | typeof ADD_20;
  readonly kind: 'integer_addition';
  readonly a: number;
  readonly b: number;
}
interface MultiplicationTask {
  readonly subject: 'math';
  readonly course: 'multiplication';
  readonly skillId: typeof MULT_FACTS;
  readonly kind: 'integer_multiplication';
  readonly a: number;
  readonly b: number;
}
interface DivisionTask {
  readonly subject: 'math';
  readonly course: 'division';
  readonly skillId: typeof DIV_FACTS;
  readonly kind: 'integer_division';
  readonly dividend: number;
  readonly divisor: number;
}
interface FractionalGroupsTaskT {
  readonly subject: 'math';
  readonly course: 'fractional-groups';
  readonly skillId: typeof FRAC_GROUPS;
  readonly kind: 'fractional_groups';
  readonly wholes: number;
  readonly unitDenominator: number;
}
interface SubtractionTask {
  readonly subject: 'math';
  readonly course: 'subtraction' | 'subtraction-g2';
  readonly skillId: typeof SUB_10 | typeof SUB_20 | typeof SUB_100;
  readonly kind: 'integer_subtraction';
  readonly a: number;
  readonly b: number;
}
interface WholeCompareTask {
  readonly subject: 'math';
  readonly course: 'whole-number' | 'whole-number-g2';
  readonly skillId: typeof CMP_WHOLE | typeof CMP_WHOLE_200;
  readonly kind: 'integer_comparison';
  readonly a: number;
  readonly b: number;
}
interface WholeOrderTask {
  readonly subject: 'math';
  readonly course: 'whole-number' | 'whole-number-g2';
  readonly skillId: typeof ORD_WHOLE | typeof ORD_WHOLE_200;
  readonly kind: 'integer_ordering';
  readonly numbers: readonly number[];
}
interface SkipCountTaskT {
  readonly subject: 'math';
  readonly course: 'skip-count' | 'skip-count-g2';
  readonly skillId: typeof SKIP_COUNT | typeof SKIP_COUNT_200;
  readonly kind: 'skip_count_next';
  readonly start: number;
  readonly step: number;
  readonly length: number;
}
interface ExprEquivTask {
  readonly subject: 'math';
  readonly course: 'algebra-equiv';
  readonly skillId: typeof EQUIV_EXPR;
  readonly kind: 'expr_equivalence';
  readonly left: Expr;
  readonly right: Expr;
}
interface ExprEquivMulDivTask {
  readonly subject: 'math';
  readonly course: 'algebra-equiv-g3';
  readonly skillId: typeof EQUIV_EXPR_MULDIV;
  readonly kind: 'expr_equivalence_muldiv';
  readonly left: ExprMulDiv;
  readonly right: ExprMulDiv;
}
interface ComposeTask {
  readonly subject: 'math';
  readonly course: 'place-value';
  readonly skillId: typeof COMPOSE_50;
  readonly kind: 'place_value_compose';
  readonly tens: number;
  readonly ones: number;
}
interface ComposeHctoTaskT {
  readonly subject: 'math';
  readonly course: 'place-value-g2';
  readonly skillId: typeof COMPOSE_200;
  readonly kind: 'compose_hcto';
  readonly hundreds: number;
  readonly tens: number;
  readonly ones: number;
}
interface CoinValueTaskT {
  readonly subject: 'math';
  readonly course: 'financial' | 'money-100';
  readonly skillId: typeof COIN_VALUE | typeof MONEY_100;
  readonly kind: 'coin_value';
  readonly pieces: readonly number[];
}

/** The total bound for a coin_value item, in cents — $100 for the G2 skill. */
const coinValueCap = (task: CoinValueTaskT): number => (task.skillId === MONEY_100 ? 10000 : 5000);
interface RepresentSelectTask {
  readonly subject: 'math';
  readonly course: 'number-rep';
  readonly skillId: typeof REPRESENT_50;
  readonly kind: 'number_representation_select';
  readonly target: number;
  readonly options: readonly RepresentationOption[];
}
interface PositionalSelectTaskT {
  readonly subject: 'math';
  readonly course: 'spatial';
  readonly skillId: typeof POSITIONAL;
  readonly kind: 'positional_select';
  readonly relation: PositionRelation;
  readonly options: readonly PositionalScene[];
}
interface GraphReadSelectTaskT {
  readonly subject: 'math';
  readonly course: 'data-handling';
  readonly skillId: typeof DATA_INTERPRET;
  readonly kind: 'graph_read_select';
  readonly mode: GraphReadMode;
  readonly categories: readonly GraphCategory[];
}
interface ShapeAttrSelectTaskT {
  readonly subject: 'math';
  readonly course: 'geometry';
  readonly skillId: typeof SHAPE_ATTR;
  readonly kind: 'shape_attribute_select';
  readonly targetSides: number;
  readonly options: readonly ShapeOption[];
}
interface CalendarTaskT {
  readonly subject: 'math';
  readonly course: 'calendar';
  readonly skillId: typeof CALENDAR_DAY;
  readonly kind: 'calendar_next_day';
  readonly day: string;
  readonly offset: number;
}
interface EstimateTaskT {
  readonly subject: 'math';
  readonly course: 'estimation' | 'estimation-g2';
  readonly skillId: typeof ESTIMATE_50 | typeof ESTIMATE_200;
  readonly kind: 'estimate_within_band';
  readonly actual: number;
  readonly low: number;
  readonly high: number;
}
interface RoundWholeTaskT {
  readonly subject: 'math';
  readonly course: 'rounding';
  readonly skillId: typeof ROUND_WHOLE;
  readonly kind: 'round_whole';
  readonly value: number;
  readonly place: RoundPlace;
}
interface MultidigitMultTaskT {
  readonly subject: 'math';
  readonly course: 'multiplication-g4';
  readonly skillId: typeof MULT_MULTIDIGIT;
  readonly kind: 'multidigit_multiplication';
  readonly multiplicand: number;
  readonly multiplier: number;
}
interface DivisionRemainderTaskT {
  readonly subject: 'math';
  readonly course: 'division-g4';
  readonly skillId: typeof DIV_REMAINDER;
  readonly kind: 'division_with_remainder';
  readonly dividend: number;
  readonly divisor: number;
}
interface DateOffsetSelectTaskT {
  readonly subject: 'math';
  readonly course: 'date-calendar';
  readonly skillId: typeof DATE_OFFSET;
  readonly kind: 'date_offset_select';
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly offset: number;
  readonly options: readonly CalendarDate[];
}
interface CodeReachSelectTaskT {
  readonly subject: 'math';
  readonly course: 'coding';
  readonly skillId: typeof CODE_SEQUENCE;
  readonly kind: 'code_reach_select';
  readonly rows: number;
  readonly cols: number;
  readonly start: Cell;
  readonly goal: Cell;
  readonly options: readonly (readonly Move[])[];
}
interface WordProblemTaskT {
  readonly subject: 'math';
  readonly course: 'word-problems' | 'word-problems-g2';
  readonly skillId: typeof WORD_PROBLEM | typeof WORD_PROBLEM_100;
  readonly kind: 'word_problem';
  readonly a: number;
  readonly b: number;
  readonly op: WordOp;
  /** The authored story the quantities fill (presentation only). */
  readonly scenario: string;
}
interface BuildNumberTaskT {
  readonly subject: 'math';
  readonly course: 'construction';
  readonly skillId: typeof BUILD_NUMBER;
  readonly kind: 'build_number';
  readonly target: number;
}
interface ParityTaskT {
  readonly subject: 'math';
  readonly course: 'even-odd';
  readonly skillId: typeof EVEN_ODD;
  readonly kind: 'number_parity';
  readonly n: number;
}
interface PartitionTask {
  readonly subject: 'math';
  readonly course: 'fractions';
  readonly skillId: typeof PARTITION;
  readonly kind: 'fraction_partition';
  readonly parts: number;
  readonly shaded: number;
}
interface UnitTask {
  readonly subject: 'math';
  readonly course: 'fractions';
  readonly skillId: typeof UNIT;
  readonly kind: 'fraction_unit';
  readonly denominator: number;
}
interface NonUnitTask {
  readonly subject: 'math';
  readonly course: 'fractions';
  readonly skillId: typeof NONUNIT;
  readonly kind: 'fraction_nonunit_build';
  readonly count: number;
  readonly unitDenominator: number;
}
interface NumberLineTask {
  readonly subject: 'math';
  readonly course: 'fractions';
  readonly skillId: typeof NUMBERLINE;
  readonly kind: 'fraction_number_line';
  readonly fraction: Fraction;
  readonly intervals: number;
}
interface OrderTask {
  readonly subject: 'math';
  readonly course: 'fractions';
  readonly skillId: typeof ORDER;
  readonly kind: 'fraction_order';
  readonly fractions: readonly Fraction[];
}
interface PastTenseTask {
  readonly subject: 'english';
  readonly course: 'past-tense';
  readonly skillId: typeof PAST;
  readonly kind: 'regular_past_tense';
  readonly verb: string;
}
interface ComparativeTask {
  readonly subject: 'english';
  readonly course: 'comparative';
  readonly skillId: typeof COMP;
  readonly kind: 'comparative_adjective';
  readonly adjective: string;
}
export type Task =
  | CompareTask
  | EquivTask
  | PluralTask
  | AdditionTask
  | MultiplicationTask
  | DivisionTask
  | FractionalGroupsTaskT
  | SubtractionTask
  | WholeCompareTask
  | WholeOrderTask
  | SkipCountTaskT
  | ExprEquivTask
  | ExprEquivMulDivTask
  | ComposeTask
  | ComposeHctoTaskT
  | CoinValueTaskT
  | RepresentSelectTask
  | PositionalSelectTaskT
  | GraphReadSelectTaskT
  | ShapeAttrSelectTaskT
  | CalendarTaskT
  | EstimateTaskT
  | RoundWholeTaskT
  | MultidigitMultTaskT
  | DivisionRemainderTaskT
  | DateOffsetSelectTaskT
  | CodeReachSelectTaskT
  | WordProblemTaskT
  | BuildNumberTaskT
  | ParityTaskT
  | PartitionTask
  | UnitTask
  | NonUnitTask
  | NumberLineTask
  | OrderTask
  | PastTenseTask
  | ComparativeTask;

const f = (numerator: number, denominator: number): Fraction => ({ numerator, denominator });
const cmp = (left: Fraction, right: Fraction): CompareTask => ({
  subject: 'math',
  course: 'fractions',
  skillId: COMPARE,
  kind: 'fraction_comparison',
  left,
  right,
});
const eq = (left: Fraction, right: Fraction): EquivTask => ({
  subject: 'math',
  course: 'fractions',
  skillId: EQUIV,
  kind: 'fraction_equivalence',
  left,
  right,
});
const plural = (skillId: PluralTask['skillId'], word: string): PluralTask => ({
  subject: 'english',
  course: 'plurals',
  skillId,
  kind: 'noun_plural',
  word,
});
const add = (skillId: AdditionTask['skillId'], a: number, b: number): AdditionTask => ({
  subject: 'math',
  course: 'addition',
  skillId,
  kind: 'integer_addition',
  a,
  b,
});
const mult = (a: number, b: number): MultiplicationTask => ({
  subject: 'math',
  course: 'multiplication',
  skillId: MULT_FACTS,
  kind: 'integer_multiplication',
  a,
  b,
});
const div = (dividend: number, divisor: number): DivisionTask => ({
  subject: 'math',
  course: 'division',
  skillId: DIV_FACTS,
  kind: 'integer_division',
  dividend,
  divisor,
});
const fracGroups = (wholes: number, unitDenominator: number): FractionalGroupsTaskT => ({
  subject: 'math',
  course: 'fractional-groups',
  skillId: FRAC_GROUPS,
  kind: 'fractional_groups',
  wholes,
  unitDenominator,
});
const sub = (skillId: SubtractionTask['skillId'], a: number, b: number): SubtractionTask => ({
  subject: 'math',
  course: 'subtraction',
  skillId,
  kind: 'integer_subtraction',
  a,
  b,
});
const sub2 = (a: number, b: number): SubtractionTask => ({
  subject: 'math',
  course: 'subtraction-g2',
  skillId: SUB_100,
  kind: 'integer_subtraction',
  a,
  b,
});
const cmpW = (a: number, b: number): WholeCompareTask => ({
  subject: 'math',
  course: 'whole-number',
  skillId: CMP_WHOLE,
  kind: 'integer_comparison',
  a,
  b,
});
const ordW = (numbers: readonly number[]): WholeOrderTask => ({
  subject: 'math',
  course: 'whole-number',
  skillId: ORD_WHOLE,
  kind: 'integer_ordering',
  numbers,
});
const cmpW2 = (a: number, b: number): WholeCompareTask => ({
  subject: 'math',
  course: 'whole-number-g2',
  skillId: CMP_WHOLE_200,
  kind: 'integer_comparison',
  a,
  b,
});
const ordW2 = (numbers: readonly number[]): WholeOrderTask => ({
  subject: 'math',
  course: 'whole-number-g2',
  skillId: ORD_WHOLE_200,
  kind: 'integer_ordering',
  numbers,
});
const skip = (start: number, step: number, length: number): SkipCountTaskT => ({
  subject: 'math',
  course: 'skip-count',
  skillId: SKIP_COUNT,
  kind: 'skip_count_next',
  start,
  step,
  length,
});
const skip2 = (start: number, step: number, length: number): SkipCountTaskT => ({
  subject: 'math',
  course: 'skip-count-g2',
  skillId: SKIP_COUNT_200,
  kind: 'skip_count_next',
  start,
  step,
  length,
});
const e = (a: number, op: Expr['op'], b: number): Expr => ({ a, op, b });
const eMd = (a: number, op: ExprMulDiv['op'], b: number): ExprMulDiv => ({ a, op, b });
const equivExpr = (left: Expr, right: Expr): ExprEquivTask => ({
  subject: 'math',
  course: 'algebra-equiv',
  skillId: EQUIV_EXPR,
  kind: 'expr_equivalence',
  left,
  right,
});
const equivExprMulDiv = (left: ExprMulDiv, right: ExprMulDiv): ExprEquivMulDivTask => ({
  subject: 'math',
  course: 'algebra-equiv-g3',
  skillId: EQUIV_EXPR_MULDIV,
  kind: 'expr_equivalence_muldiv',
  left,
  right,
});
const compose = (tens: number, ones: number): ComposeTask => ({
  subject: 'math',
  course: 'place-value',
  skillId: COMPOSE_50,
  kind: 'place_value_compose',
  tens,
  ones,
});
const composeHcto = (hundreds: number, tens: number, ones: number): ComposeHctoTaskT => ({
  subject: 'math',
  course: 'place-value-g2',
  skillId: COMPOSE_200,
  kind: 'compose_hcto',
  hundreds,
  tens,
  ones,
});
const coins = (pieces: readonly number[]): CoinValueTaskT => ({
  subject: 'math',
  course: 'financial',
  skillId: COIN_VALUE,
  kind: 'coin_value',
  pieces,
});
const money100 = (pieces: readonly number[]): CoinValueTaskT => ({
  subject: 'math',
  course: 'money-100',
  skillId: MONEY_100,
  kind: 'coin_value',
  pieces,
});
const repSelect = (
  target: number,
  options: readonly RepresentationOption[],
): RepresentSelectTask => ({
  subject: 'math',
  course: 'number-rep',
  skillId: REPRESENT_50,
  kind: 'number_representation_select',
  target,
  options,
});
const posSelect = (
  relation: PositionRelation,
  options: readonly PositionalScene[],
): PositionalSelectTaskT => ({
  subject: 'math',
  course: 'spatial',
  skillId: POSITIONAL,
  kind: 'positional_select',
  relation,
  options,
});
const graphRead = (
  mode: GraphReadMode,
  categories: readonly GraphCategory[],
): GraphReadSelectTaskT => ({
  subject: 'math',
  course: 'data-handling',
  skillId: DATA_INTERPRET,
  kind: 'graph_read_select',
  mode,
  categories,
});
const shapeSort = (targetSides: number, options: readonly ShapeOption[]): ShapeAttrSelectTaskT => ({
  subject: 'math',
  course: 'geometry',
  skillId: SHAPE_ATTR,
  kind: 'shape_attribute_select',
  targetSides,
  options,
});
const calendarDay = (day: string, offset: number): CalendarTaskT => ({
  subject: 'math',
  course: 'calendar',
  skillId: CALENDAR_DAY,
  kind: 'calendar_next_day',
  day,
  offset,
});
const estimate = (actual: number, low: number, high: number): EstimateTaskT => ({
  subject: 'math',
  course: 'estimation',
  skillId: ESTIMATE_50,
  kind: 'estimate_within_band',
  actual,
  low,
  high,
});
const estimate200 = (actual: number, low: number, high: number): EstimateTaskT => ({
  subject: 'math',
  course: 'estimation-g2',
  skillId: ESTIMATE_200,
  kind: 'estimate_within_band',
  actual,
  low,
  high,
});
const roundWhole = (value: number, place: RoundPlace): RoundWholeTaskT => ({
  subject: 'math',
  course: 'rounding',
  skillId: ROUND_WHOLE,
  kind: 'round_whole',
  value,
  place,
});
const multidigitMult = (multiplicand: number, multiplier: number): MultidigitMultTaskT => ({
  subject: 'math',
  course: 'multiplication-g4',
  skillId: MULT_MULTIDIGIT,
  kind: 'multidigit_multiplication',
  multiplicand,
  multiplier,
});
const divRemainder = (dividend: number, divisor: number): DivisionRemainderTaskT => ({
  subject: 'math',
  course: 'division-g4',
  skillId: DIV_REMAINDER,
  kind: 'division_with_remainder',
  dividend,
  divisor,
});
/** Parse a "quotient remainder" answer string (two non-negative integers). */
const parseQuotientRemainder = (a: string): { q: number; r: number } | null => {
  const m = a.trim().match(/^(\d+)\s+(\d+)$/);
  return m ? { q: Number(m[1]), r: Number(m[2]) } : null;
};
const dateOffset = (
  year: number,
  month: number,
  day: number,
  offset: number,
  options: readonly CalendarDate[],
): DateOffsetSelectTaskT => ({
  subject: 'math',
  course: 'date-calendar',
  skillId: DATE_OFFSET,
  kind: 'date_offset_select',
  year,
  month,
  day,
  offset,
  options,
});
const codeReach = (
  rows: number,
  cols: number,
  start: Cell,
  goal: Cell,
  options: readonly (readonly Move[])[],
): CodeReachSelectTaskT => ({
  subject: 'math',
  course: 'coding',
  skillId: CODE_SEQUENCE,
  kind: 'code_reach_select',
  rows,
  cols,
  start,
  goal,
  options,
});
const wordProblem = (a: number, op: WordOp, b: number, scenario: string): WordProblemTaskT => ({
  subject: 'math',
  course: 'word-problems',
  skillId: WORD_PROBLEM,
  kind: 'word_problem',
  a,
  b,
  op,
  scenario,
});
const wordProblem100 = (a: number, op: WordOp, b: number, scenario: string): WordProblemTaskT => ({
  subject: 'math',
  course: 'word-problems-g2',
  skillId: WORD_PROBLEM_100,
  kind: 'word_problem',
  a,
  b,
  op,
  scenario,
});
const buildNumber = (target: number): BuildNumberTaskT => ({
  subject: 'math',
  course: 'construction',
  skillId: BUILD_NUMBER,
  kind: 'build_number',
  target,
});
const parity = (n: number): ParityTaskT => ({
  subject: 'math',
  course: 'even-odd',
  skillId: EVEN_ODD,
  kind: 'number_parity',
  n,
});
const partition = (parts: number, shaded: number): PartitionTask => ({
  subject: 'math',
  course: 'fractions',
  skillId: PARTITION,
  kind: 'fraction_partition',
  parts,
  shaded,
});
const unit = (denominator: number): UnitTask => ({
  subject: 'math',
  course: 'fractions',
  skillId: UNIT,
  kind: 'fraction_unit',
  denominator,
});
const nonunit = (count: number, unitDenominator: number): NonUnitTask => ({
  subject: 'math',
  course: 'fractions',
  skillId: NONUNIT,
  kind: 'fraction_nonunit_build',
  count,
  unitDenominator,
});
const numberline = (fraction: Fraction, intervals: number): NumberLineTask => ({
  subject: 'math',
  course: 'fractions',
  skillId: NUMBERLINE,
  kind: 'fraction_number_line',
  fraction,
  intervals,
});
const order = (fractions: readonly Fraction[]): OrderTask => ({
  subject: 'math',
  course: 'fractions',
  skillId: ORDER,
  kind: 'fraction_order',
  fractions,
});
const pastTask = (verb: string): PastTenseTask => ({
  subject: 'english',
  course: 'past-tense',
  skillId: PAST,
  kind: 'regular_past_tense',
  verb,
});
const compTask = (adjective: string): ComparativeTask => ({
  subject: 'english',
  course: 'comparative',
  skillId: COMP,
  kind: 'comparative_adjective',
  adjective,
});

export const TASK_BANK: Readonly<Record<string, Task>> = {
  'frac-cmp-1': cmp(f(1, 2), f(1, 3)), // gt
  'frac-cmp-2': cmp(f(2, 4), f(1, 2)), // eq
  'frac-cmp-3': cmp(f(1, 3), f(1, 2)), // lt
  'frac-eq-1': eq(f(1, 2), f(2, 4)), // yes
  'frac-eq-2': eq(f(1, 2), f(1, 3)), // no
  'frac-eq-3': eq(f(2, 3), f(4, 6)), // yes
  'frac-cmp-4': cmp(f(2, 5), f(3, 5)), // lt
  'frac-eq-4': eq(f(2, 5), f(1, 2)), // no
  'eng-base-1': plural(PLURAL_BASE, 'dog'), // dogs
  'eng-base-2': plural(PLURAL_BASE, 'book'), // books
  'eng-base-3': plural(PLURAL_BASE, 'cat'), // cats
  'eng-base-4': plural(PLURAL_BASE, 'map'), // maps
  'eng-sib-1': plural(PLURAL_SIB, 'box'), // boxes
  'eng-sib-2': plural(PLURAL_SIB, 'baby'), // babies
  'eng-sib-3': plural(PLURAL_SIB, 'dish'), // dishes
  'eng-sib-4': plural(PLURAL_SIB, 'bus'), // buses
  'add-10-1': add(ADD_10, 3, 4), // 7
  'add-10-2': add(ADD_10, 2, 5), // 7
  'add-10-3': add(ADD_10, 6, 1), // 7
  'add-10-4': add(ADD_10, 4, 3), // 7
  'add-20-1': add(ADD_20, 8, 5), // 13
  'add-20-2': add(ADD_20, 7, 6), // 13
  'add-20-3': add(ADD_20, 9, 4), // 13
  'add-20-4': add(ADD_20, 6, 8), // 14
  'mult-1': mult(2, 7), // 14 (facts of 2)
  'mult-2': mult(5, 6), // 30 (facts of 5)
  'mult-3': mult(10, 4), // 40 (facts of 10)
  'mult-4': mult(8, 3), // 24 (adds-instead-of-multiplies trap → 11)
  'div-1': div(14, 2), // 7 (related to 2 × 7)
  'div-2': div(30, 5), // 6 (facts of 5)
  'div-3': div(40, 10), // 4 (facts of 10)
  'div-4': div(24, 3), // 8 (subtracts-instead-of-divides trap → 21)
  'fgrp-1': fracGroups(3, 2), // halves in 3 wholes = 6
  'fgrp-2': fracGroups(2, 4), // fourths in 2 wholes = 8
  'fgrp-3': fracGroups(4, 3), // thirds in 4 wholes = 12
  'fgrp-4': fracGroups(5, 2), // halves in 5 wholes = 10 (counts-wholes trap → 5)
  'sub-10-1': sub(SUB_10, 7, 3), // 4
  'sub-10-2': sub(SUB_10, 9, 5), // 4
  'sub-10-3': sub(SUB_10, 8, 2), // 6
  'sub-10-4': sub(SUB_10, 6, 4), // 2
  'sub-20-1': sub(SUB_20, 13, 5), // 8 (crossing ten)
  'sub-20-2': sub(SUB_20, 15, 7), // 8 (crossing ten)
  'sub-20-3': sub(SUB_20, 14, 6), // 8 (crossing ten)
  'sub-20-4': sub(SUB_20, 12, 8), // 4 (crossing ten)
  // Grade 2 — subtraction to 100 (same oracle, higher bound; some with regrouping).
  'sub100-1': sub2(45, 23), // 22 (no regroup)
  'sub100-2': sub2(62, 28), // 34 (regroup)
  'sub100-3': sub2(80, 35), // 45 (regroup across a ten)
  'sub100-4': sub2(57, 6), // 51
  'cmpw-1': cmpW(12, 21), // lt (ones-digit trap: 2 > 1)
  'cmpw-2': cmpW(34, 29), // gt (tens decide)
  'cmpw-3': cmpW(40, 40), // eq
  'cmpw-4': cmpW(9, 15), // lt (single vs double digit)
  'ordw-1': ordW([23, 8, 41]), // 8 < 23 < 41 → positions 2,1,3
  'ordw-2': ordW([17, 50, 5, 32]), // 5 < 17 < 32 < 50 → 3,1,4,2
  'ordw-3': ordW([30, 13, 31]), // 13 < 30 < 31 → 2,1,3
  'ordw-4': ordW([44, 4, 40, 14]), // 4 < 14 < 40 < 44 → 2,4,3,1
  // Grade 2 — compare/order whole numbers to 200 (same oracle, higher bound).
  'cmpw2-1': cmpW2(98, 120), // lt (2-digit vs 3-digit trap)
  'cmpw2-2': cmpW2(150, 150), // eq
  'cmpw2-3': cmpW2(134, 129), // gt (tens within the same hundred)
  'cmpw2-4': cmpW2(119, 191), // lt (tens-place trap)
  'ordw2-1': ordW2([150, 95, 200]), // 95 < 150 < 200 → 2,1,3
  'ordw2-2': ordW2([112, 121, 99, 130]), // 99 < 112 < 121 < 130 → 3,1,2,4
  'ordw2-3': ordW2([80, 180, 118]), // 80 < 118 < 180 → 1,3,2
  'ordw2-4': ordW2([145, 45, 154, 15]), // 15 < 45 < 145 < 154 → 4,2,1,3
  'skip-1': skip(2, 2, 3), // 2,4,6 → 8 (by 2s)
  'skip-2': skip(5, 5, 3), // 5,10,15 → 20 (by 5s)
  'skip-3': skip(10, 10, 3), // 10,20,30 → 40 (by 10s)
  'skip-4': skip(0, 2, 4), // 0,2,4,6 → 8 (by 2s from 0)
  // Grade 2 — skip-count to 200 by 20s/25s/50s (same oracle, widened step set).
  'skip2-1': skip2(20, 20, 3), // 20,40,60 → 80 (by 20s)
  'skip2-2': skip2(25, 25, 3), // 25,50,75 → 100 (by 25s)
  'skip2-3': skip2(50, 50, 3), // 50,100,150 → 200 (by 50s)
  'skip2-4': skip2(0, 25, 4), // 0,25,50,75 → 100 (by 25s from 0)
  'equiv-1': equivExpr(e(3, '+', 4), e(9, '-', 2)), // 7 == 7 → yes
  'equiv-2': equivExpr(e(5, '+', 2), e(4, '+', 2)), // 7 vs 6 → no
  'equiv-3': equivExpr(e(6, '-', 1), e(2, '+', 3)), // 5 == 5 → yes
  'equiv-4': equivExpr(e(8, '-', 3), e(3, '+', 3)), // 5 vs 6 → no
  'equiv-md-1': equivExprMulDiv(eMd(4, '*', 3), eMd(24, '/', 2)), // 12 == 12 → yes
  'equiv-md-2': equivExprMulDiv(eMd(5, '*', 2), eMd(40, '/', 5)), // 10 vs 8 → no
  'equiv-md-3': equivExprMulDiv(eMd(2, '*', 9), eMd(6, '*', 3)), // 18 == 18 → yes
  'equiv-md-4': equivExprMulDiv(eMd(30, '/', 5), eMd(2, '*', 4)), // 6 vs 8 → no
  'compose-1': compose(3, 5), // 35
  'compose-2': compose(4, 0), // 40
  'compose-3': compose(1, 7), // 17 (concatenation trap → 17 not 107)
  'compose-4': compose(2, 9), // 29
  'compose200-1': composeHcto(1, 2, 3), // 123 (add-the-counts trap → 6)
  'compose200-2': composeHcto(1, 0, 5), // 105 (zero-ten place trap → 15)
  'compose200-3': composeHcto(2, 0, 0), // 200
  'compose200-4': composeHcto(1, 4, 6), // 146
  'coins-1': coins([10, 5]), // dime + nickel = 15¢ (count-pieces trap → 2)
  'coins-2': coins([25, 25]), // two quarters = 50¢
  'coins-3': coins([25, 10, 10, 5]), // 50¢
  'coins-4': coins([100, 25, 10]), // loonie + quarter + dime = 135¢
  'money100-1': money100([5000, 2000]), // $50 + $20 = 7000¢
  'money100-2': money100([5000, 2000, 2000, 1000]), // $100 exactly = 10000¢
  'money100-3': money100([5000, 1000, 200, 100, 25]), // $61.25 = 6125¢
  'money100-4': money100([2000, 2000, 1000, 500, 200]), // $57 = 5700¢
  // Selection items ("which shows N?"): exactly one option composes to the target;
  // distractors swap tens/ones or drop a place. The oracle recomputes the key.
  'rep-1': repSelect(23, [
    { tens: 2, ones: 3 }, // 23 ✓
    { tens: 3, ones: 2 }, // 32 (swap)
    { tens: 1, ones: 3 }, // 13
  ]),
  'rep-2': repSelect(40, [
    { tens: 0, ones: 4 }, // 4
    { tens: 4, ones: 0 }, // 40 ✓
    { tens: 3, ones: 0 }, // 30
  ]),
  'rep-3': repSelect(17, [
    { tens: 7, ones: 1 }, // 71 (swap)
    { tens: 1, ones: 7 }, // 17 ✓
    { tens: 1, ones: 0 }, // 10
  ]),
  'rep-4': repSelect(35, [
    { tens: 3, ones: 5 }, // 35 ✓
    { tens: 5, ones: 3 }, // 53 (swap)
    { tens: 3, ones: 0 }, // 30
  ]),
  // Positional selection ("which picture shows the star <relation> the box?"):
  // exactly one scene satisfies the relation; the oracle recomputes it.
  'pos-1': posSelect('above', [
    { subject: { r: 0, c: 1 }, reference: { r: 2, c: 1 } }, // above ✓
    { subject: { r: 2, c: 1 }, reference: { r: 0, c: 1 } }, // below
    { subject: { r: 1, c: 0 }, reference: { r: 1, c: 2 } }, // same row
  ]),
  'pos-2': posSelect('right_of', [
    { subject: { r: 1, c: 0 }, reference: { r: 1, c: 2 } }, // left
    { subject: { r: 1, c: 2 }, reference: { r: 1, c: 0 } }, // right ✓
    { subject: { r: 0, c: 1 }, reference: { r: 2, c: 1 } }, // same col
  ]),
  'pos-3': posSelect('below', [
    { subject: { r: 2, c: 0 }, reference: { r: 0, c: 0 } }, // below ✓
    { subject: { r: 0, c: 0 }, reference: { r: 2, c: 0 } }, // above
    { subject: { r: 1, c: 1 }, reference: { r: 1, c: 0 } }, // same row
  ]),
  'pos-4': posSelect('left_of', [
    { subject: { r: 0, c: 2 }, reference: { r: 0, c: 0 } }, // right
    { subject: { r: 0, c: 0 }, reference: { r: 0, c: 2 } }, // left ✓
    { subject: { r: 0, c: 1 }, reference: { r: 2, c: 1 } }, // same col
  ]),
  // Data-interpretation selection ("which category has the most/fewest?"): the
  // oracle recomputes the unique extreme; a tie would be ill-posed and blocked.
  'data-1': graphRead('most', [
    { label: 'apples', count: 5 }, // most ✓
    { label: 'bananas', count: 3 },
    { label: 'cherries', count: 2 },
  ]),
  'data-2': graphRead('fewest', [
    { label: 'red', count: 4 },
    { label: 'blue', count: 1 }, // fewest ✓
    { label: 'green', count: 6 },
  ]),
  'data-3': graphRead('most', [
    { label: 'cats', count: 2 },
    { label: 'dogs', count: 7 }, // most ✓
    { label: 'fish', count: 5 },
  ]),
  'data-4': graphRead('fewest', [
    { label: 'sunny', count: 3 },
    { label: 'rainy', count: 2 }, // fewest ✓
    { label: 'cloudy', count: 5 },
  ]),
  // Shape-attribute selection ("which shape has N sides?"): the oracle counts
  // sides and finds the one match (a circle is 0 sides).
  'shape-1': shapeSort(3, [
    { name: 'triangle', sides: 3 }, // ✓
    { name: 'square', sides: 4 },
    { name: 'pentagon', sides: 5 },
  ]),
  'shape-2': shapeSort(4, [
    { name: 'triangle', sides: 3 },
    { name: 'square', sides: 4 }, // ✓
    { name: 'circle', sides: 0 },
  ]),
  'shape-3': shapeSort(5, [
    { name: 'square', sides: 4 },
    { name: 'pentagon', sides: 5 }, // ✓
    { name: 'hexagon', sides: 6 },
  ]),
  'shape-4': shapeSort(6, [
    { name: 'pentagon', sides: 5 },
    { name: 'hexagon', sides: 6 }, // ✓
    { name: 'triangle', sides: 3 },
  ]),
  // Calendar: name the day a given number of days from another (the week wraps).
  'cal-1': calendarDay('wednesday', 1), // thursday
  'cal-2': calendarDay('monday', 1), // tuesday
  'cal-3': calendarDay('friday', 1), // saturday
  'cal-4': calendarDay('saturday', 1), // sunday (wrap)
  // Estimation: a reviewed tolerance band around the true count (bands are
  // placeholders for educator-set values).
  'est-1': estimate(24, 20, 28), // ~24
  'est-2': estimate(12, 9, 15), // ~12
  'est-3': estimate(40, 34, 46), // ~40
  'est-4': estimate(31, 27, 35), // ~31
  'est200-1': estimate200(120, 100, 140), // ~120
  'est200-2': estimate200(85, 70, 100), // ~85
  'est200-3': estimate200(160, 140, 180), // ~160
  'est200-4': estimate200(195, 175, 200), // ~195
  'round-1': roundWhole(47, 10), // 50 (nearest ten)
  'round-2': roundWhole(432, 100), // 400 (nearest hundred)
  'round-3': roundWhole(2750, 1000), // 3000 (half rounds up)
  'round-4': roundWhole(1489, 100), // 1500 (truncate-trap → 1400)
  'mmul-1': multidigitMult(34, 6), // 204 (2-digit × 1-digit)
  'mmul-2': multidigitMult(125, 3), // 375 (3-digit × 1-digit)
  'mmul-3': multidigitMult(47, 100), // 4700 (× a power of ten)
  'mmul-4': multidigitMult(28, 5), // 140 (ones-digit-only trap → 40)
  'drem-1': divRemainder(47, 5), // 9 r 2
  'drem-2': divRemainder(100, 7), // 14 r 2
  'drem-3': divRemainder(83, 4), // 20 r 3
  'drem-4': divRemainder(29, 6), // 4 r 5 (drops-remainder trap → "4 0")
  // Date arithmetic across months (year 2026, non-leap); exactly one option matches.
  'date-1': dateOffset(2026, 3, 5, 3, [
    { month: 3, day: 8 }, // Mar 8 ✓
    { month: 3, day: 9 },
    { month: 3, day: 7 },
  ]),
  'date-2': dateOffset(2026, 3, 30, 2, [
    { month: 4, day: 1 }, // Apr 1 ✓ (rollover)
    { month: 3, day: 31 },
    { month: 4, day: 2 },
  ]),
  'date-3': dateOffset(2026, 2, 27, 3, [
    { month: 3, day: 2 }, // Mar 2 ✓ (Feb has 28)
    { month: 3, day: 1 },
    { month: 3, day: 3 },
  ]),
  'date-4': dateOffset(2026, 4, 29, 3, [
    { month: 5, day: 2 }, // May 2 ✓ (Apr has 30)
    { month: 5, day: 1 },
    { month: 4, day: 30 },
  ]),
  // Coding: pick the program that drives the robot from start to goal on a 3×3 grid.
  'code-1': codeReach(3, 3, { r: 0, c: 0 }, { r: 0, c: 2 }, [
    ['right', 'right'], // ✓
    ['right'],
    ['down', 'right'],
  ]),
  'code-2': codeReach(3, 3, { r: 0, c: 0 }, { r: 2, c: 0 }, [
    ['down', 'down'], // ✓
    ['down'],
    ['right', 'down'],
  ]),
  'code-3': codeReach(3, 3, { r: 2, c: 0 }, { r: 0, c: 2 }, [
    ['up', 'up', 'right', 'right'], // ✓
    ['up', 'right'],
    ['right', 'right', 'up'],
  ]),
  'code-4': codeReach(3, 3, { r: 1, c: 1 }, { r: 0, c: 1 }, [
    ['up'], // ✓
    ['down'],
    ['left', 'up'],
  ]),
  // Word problems: an authored story + a templated operation; the oracle checks
  // the arithmetic (no free-text comprehension).
  'wp-1': wordProblem(5, '+', 3, 'There are 5 apples in a basket. You put in 3 more.'), // 8
  'wp-2': wordProblem(7, '-', 2, '7 birds are on a wire. 2 of them fly away.'), // 5
  'wp-3': wordProblem(6, '+', 8, 'A bin has 6 red blocks and 8 blue blocks.'), // 14
  'wp-4': wordProblem(12, '-', 4, 'A box holds 12 crayons. You take out 4.'), // 8
  'wp100-1': wordProblem100(34, '+', 25, 'The library has 34 picture books. 25 more are donated.'), // 59
  'wp100-2': wordProblem100(
    80,
    '-',
    45,
    '80 tickets were printed for the fair. 45 have been sold.',
  ), // 35
  'wp100-3': wordProblem100(56, '+', 38, 'A farm collects 56 eggs on Monday and 38 on Tuesday.'), // 94
  'wp100-4': wordProblem100(72, '-', 19, 'A jar holds 72 beads. 19 are used for a bracelet.'), // 53
  // Construction: build a target number from tens and ones (any valid decomposition).
  'build-1': buildNumber(24),
  'build-2': buildNumber(30),
  'build-3': buildNumber(47),
  'build-4': buildNumber(16),
  // Grade 2 — even or odd (parity decided by the ones digit).
  'parity-1': parity(7), // odd
  'parity-2': parity(10), // even
  'parity-3': parity(23), // odd (first-digit trap: 2 is even)
  'parity-4': parity(36), // even
  // Transfer (novel-context) tasks — a mastered skill applied to fresh items.
  'frac-xfer-cmp': cmp(f(3, 4), f(2, 3)), // gt
  'frac-xfer-eq': eq(f(3, 6), f(1, 2)), // yes
  'eng-xfer-base': plural(PLURAL_BASE, 'pen'), // pens
  'eng-xfer-sib': plural(PLURAL_SIB, 'wish'), // wishes
  'add-xfer-10': add(ADD_10, 4, 5), // 9
  'add-xfer-20': add(ADD_20, 8, 7), // 15
  'mult-xfer': mult(6, 7), // 42 (novel fact)
  'div-xfer': div(42, 6), // 7 (novel fact)
  'fgrp-xfer': fracGroups(3, 4), // fourths in 3 wholes = 12 (novel)
  'sub-xfer-10': sub(SUB_10, 9, 4), // 5
  'sub-xfer-20': sub(SUB_20, 16, 9), // 7 (crossing ten)
  'sub100-xfer': sub2(73, 47), // 26 (regroup)
  'cmpw-xfer': cmpW(27, 19), // gt
  'ordw-xfer': ordW([38, 3, 45, 15]), // 3 < 15 < 38 < 45 → 2,4,1,3
  'cmpw2-xfer': cmpW2(137, 173), // lt
  'ordw2-xfer': ordW2([160, 16, 106]), // 16 < 106 < 160 → 2,3,1
  'skip-xfer': skip(15, 5, 3), // 15,20,25 → 30 (by 5s, novel start)
  'skip2-xfer': skip2(50, 25, 3), // 50,75,100 → 125 (by 25s, novel start)
  'equiv-xfer': equivExpr(e(7, '+', 2), e(10, '-', 1)), // 9 == 9 → yes
  'equiv-md-xfer': equivExprMulDiv(eMd(6, '*', 4), eMd(48, '/', 2)), // 24 == 24 → yes
  'compose-xfer': compose(4, 6), // 46
  'compose200-xfer': composeHcto(1, 7, 2), // 172 (novel composition)
  'coins-xfer': coins([200, 100, 25]), // toonie + loonie + quarter = 325¢
  'money100-xfer': money100([5000, 2000, 500, 500]), // $80 = 8000¢
  'rep-xfer': repSelect(46, [
    { tens: 4, ones: 6 }, // 46 ✓
    { tens: 6, ones: 4 }, // 64 (swap)
    { tens: 4, ones: 0 }, // 40
  ]),
  'pos-xfer': posSelect('above', [
    { subject: { r: 1, c: 2 }, reference: { r: 2, c: 0 } }, // above ✓
    { subject: { r: 2, c: 0 }, reference: { r: 0, c: 1 } }, // below
  ]),
  'data-xfer': graphRead('most', [
    { label: 'soccer', count: 6 },
    { label: 'hockey', count: 9 }, // most ✓
    { label: 'swimming', count: 4 },
  ]),
  'shape-xfer': shapeSort(4, [
    { name: 'square', sides: 4 }, // ✓
    { name: 'triangle', sides: 3 },
    { name: 'pentagon', sides: 5 },
  ]),
  'cal-xfer': calendarDay('sunday', -1), // saturday (yesterday, wrap back)
  'est-xfer': estimate(18, 14, 22), // ~18 (novel collection)
  'est200-xfer': estimate200(140, 120, 160), // ~140 (novel collection)
  'round-xfer': roundWhole(6512, 1000), // 7000 (novel)
  'mmul-xfer': multidigitMult(216, 4), // 864 (novel)
  'drem-xfer': divRemainder(75, 8), // 9 r 3 (novel)
  'date-xfer': dateOffset(2026, 7, 30, 4, [
    { month: 8, day: 3 }, // Aug 3 ✓ (Jul has 31)
    { month: 8, day: 4 },
    { month: 7, day: 31 },
  ]),
  'code-xfer': codeReach(3, 3, { r: 0, c: 0 }, { r: 1, c: 2 }, [
    ['right', 'right', 'down'], // ✓
    ['down', 'right'],
    ['up'],
  ]),
  'wp-xfer': wordProblem(9, '+', 5, '9 children are on the bus. At the next stop 5 more get on.'), // 14
  'wp100-xfer': wordProblem100(63, '+', 29, '63 cars are in the lot. 29 more drive in.'), // 92
  'build-xfer': buildNumber(38),
  'parity-xfer': parity(49), // odd
};

/** Tasks that exercise a skill in a NOVEL context — graded as transfer_check so a
 *  correct answer can lift an already-mastered skill to TRANSFERABLE (AT-12). */
export const TRANSFER_TASKS = new Set([
  'frac-xfer-cmp',
  'frac-xfer-eq',
  'eng-xfer-base',
  'eng-xfer-sib',
  'add-xfer-10',
  'add-xfer-20',
  'mult-xfer',
  'div-xfer',
  'fgrp-xfer',
  'sub-xfer-10',
  'sub-xfer-20',
  'sub100-xfer',
  'cmpw-xfer',
  'ordw-xfer',
  'cmpw2-xfer',
  'ordw2-xfer',
  'skip-xfer',
  'skip2-xfer',
  'equiv-xfer',
  'equiv-md-xfer',
  'compose-xfer',
  'compose200-xfer',
  'coins-xfer',
  'money100-xfer',
  'rep-xfer',
  'pos-xfer',
  'data-xfer',
  'shape-xfer',
  'cal-xfer',
  'est-xfer',
  'est200-xfer',
  'round-xfer',
  'mmul-xfer',
  'drem-xfer',
  'date-xfer',
  'code-xfer',
  'wp-xfer',
  'wp100-xfer',
  'build-xfer',
  'parity-xfer',
]);

const fmt = (x: Fraction): string => `${x.numerator}/${x.denominator}`;
const fmtExpr = (x: Expr): string => `${x.a} ${x.op} ${x.b}`;
const MULDIV_SYMBOL: Readonly<Record<ExprMulDiv['op'], string>> = {
  '+': '+',
  '-': '-',
  '*': '×',
  '/': '÷',
};
const fmtExprMulDiv = (x: ExprMulDiv): string => `${x.a} ${MULDIV_SYMBOL[x.op]} ${x.b}`;
/** A child-readable name for a Canadian money piece (by its value in cents). */
const COIN_NAME: Readonly<Record<number, string>> = {
  5: 'nickel (5¢)',
  10: 'dime (10¢)',
  25: 'quarter (25¢)',
  100: '$1 loonie',
  200: '$2 toonie',
  500: '$5 bill',
  1000: '$10 bill',
  2000: '$20 bill',
  5000: '$50 bill',
};
const fmtPieces = (pieces: readonly number[]): string =>
  pieces.map((p) => COIN_NAME[p] ?? `${p}¢`).join(', ');
/** A base-ten representation option as a child-readable label. */
const fmtRepOption = (o: RepresentationOption): string => {
  const tens = `${o.tens} ${o.tens === 1 ? 'ten' : 'tens'}`;
  const ones = `${o.ones} ${o.ones === 1 ? 'one' : 'ones'}`;
  return `${tens} and ${ones}`;
};
/** The oracle-derived correct 0-based option index for a selection task (the one
 *  option whose value equals the target); -1 if the item is ill-posed. */
const correctRepIndex = (task: RepresentSelectTask): number =>
  matchingRepresentationIndices(task.target, task.options)[0] ?? -1;
/** A positional scene as a child-readable grid description. */
const fmtScene = (s: PositionalScene): string =>
  `the star at row ${s.subject.r}, col ${s.subject.c} and the box at row ${s.reference.r}, col ${s.reference.c}`;
const RELATION_WORD: Readonly<Record<PositionRelation, string>> = {
  above: 'above',
  below: 'below',
  left_of: 'to the left of',
  right_of: 'to the right of',
};
/** The oracle-derived correct 0-based index for a positional selection; -1 if ill-posed. */
const correctPosIndex = (task: PositionalSelectTaskT): number =>
  matchingPositionalIndices(task.relation, task.options)[0] ?? -1;
/** The oracle-derived correct 0-based index for a graph-read selection; -1 if tied/ill-posed. */
const correctDataIndex = (task: GraphReadSelectTaskT): number =>
  extremeCategoryIndex(task.mode, task.categories);
/** The oracle-derived correct 0-based index for a shape-attribute selection; -1 if ill-posed. */
const correctShapeIndex = (task: ShapeAttrSelectTaskT): number =>
  matchingShapeIndices(task.targetSides, task.options)[0] ?? -1;
/** Capitalize a weekday name for display (wednesday → Wednesday). */
const capitalize = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (d: CalendarDate): string => `${MONTHS[d.month - 1] ?? '?'} ${d.day}`;
/** The oracle-derived correct 0-based index for a date-offset selection; -1 if ill-posed. */
const correctDateOffsetIndex = (task: DateOffsetSelectTaskT): number =>
  matchingDateIndices(addDays(task.year, task.month, task.day, task.offset), task.options)[0] ?? -1;
/** The oracle-derived correct 0-based index for a code-reach selection; -1 if ill-posed. */
const correctCodeIndex = (task: CodeReachSelectTaskT): number =>
  reachingProgramIndices(task)[0] ?? -1;
const fmtProgram = (moves: readonly Move[]): string => moves.join(', ');
const isRelation = (v: unknown): v is FractionRelation => v === 'lt' || v === 'eq' || v === 'gt';

/** Parse a learner "a/b" fraction token, or null if malformed. */
const parseFrac = (a: string): Fraction | null => {
  const m = a.match(/^(\d+)\/(\d+)$/);
  if (!m) return null;
  return { numerator: Number(m[1]), denominator: Number(m[2]) };
};
/** The exact tick a number-line fraction lands on (integer by construction). */
const correctTick = (t: NumberLineTask): number =>
  (t.fraction.numerator * t.intervals) / t.fraction.denominator;
const relSign = (a: Fraction, b: Fraction): number => {
  const r = trueRelation(a, b);
  return r === 'lt' ? -1 : r === 'gt' ? 1 : 0;
};
/** Ascending index order of a fraction list (the correct ordering key). */
const correctOrder = (fractions: readonly Fraction[]): number[] =>
  fractions.map((_, i) => i).sort((x, y) => relSign(fractions[x]!, fractions[y]!));
/** Parse a 1-based "2,1,3" order answer into 0-based indices. */
const parseOrder = (a: string): number[] => a.split(',').map((s) => Number(s.trim()) - 1);
/** Ascending index order of a whole-number list (the correct ordering key). */
const correctWholeOrder = (numbers: readonly number[]): number[] =>
  numbers.map((_, i) => i).sort((x, y) => numbers[x]! - numbers[y]!);

/** Representations are per-subject working modes; the projection counts their diversity. */
export const REPRESENTATIONS: Record<Subject, readonly string[]> = {
  math: ['symbolic', 'area-model', 'number-line', 'set', 'counters'],
  english: ['written', 'spoken', 'picture'],
};
export const representationOf = (task: Task, raw: unknown): string => {
  const allowed = REPRESENTATIONS[task.subject];
  return typeof raw === 'string' && allowed.includes(raw) ? raw : allowed[0];
};

/** Question + answer options presented for a task, by skill kind. */
export function present(task: Task): { question: string; options: readonly string[] } {
  if (task.kind === 'fraction_comparison') {
    return {
      question: `Compare ${fmt(task.left)} and ${fmt(task.right)} — is the first less than (lt), equal to (eq), or greater than (gt) the second?`,
      options: ['lt', 'eq', 'gt'],
    };
  }
  if (task.kind === 'fraction_equivalence') {
    return {
      question: `Are ${fmt(task.left)} and ${fmt(task.right)} equal in value? (yes / no)`,
      options: ['yes', 'no'],
    };
  }
  if (task.kind === 'integer_addition') {
    return { question: `What is ${task.a} + ${task.b}?`, options: [] /* type the number */ };
  }
  if (task.kind === 'integer_multiplication') {
    return { question: `What is ${task.a} × ${task.b}?`, options: [] /* type the number */ };
  }
  if (task.kind === 'integer_division') {
    return {
      question: `What is ${task.dividend} ÷ ${task.divisor}?`,
      options: [] /* type the number */,
    };
  }
  if (task.kind === 'fractional_groups') {
    const unit =
      task.unitDenominator === 2
        ? 'halves'
        : task.unitDenominator === 3
          ? 'thirds'
          : task.unitDenominator === 4
            ? 'fourths'
            : `one-${task.unitDenominator}ths`;
    const wholeWord = task.wholes === 1 ? 'whole' : 'wholes';
    return {
      question: `How many ${unit} are in ${task.wholes} ${wholeWord}?`,
      options: [] /* type the number */,
    };
  }
  if (task.kind === 'integer_subtraction') {
    return { question: `What is ${task.a} - ${task.b}?`, options: [] /* type the number */ };
  }
  if (task.kind === 'integer_comparison') {
    return {
      question: `Compare ${task.a} and ${task.b} — is the first less than (lt), equal to (eq), or greater than (gt) the second?`,
      options: ['lt', 'eq', 'gt'],
    };
  }
  if (task.kind === 'integer_ordering') {
    return {
      question: `Put these numbers in order from smallest to largest: ${task.numbers.join(
        ', ',
      )}. Type their positions (1 = first shown) separated by commas, e.g. 2,1,3.`,
      options: [],
    };
  }
  if (task.kind === 'skip_count_next') {
    return {
      question: `What number comes next? ${skipCountSequence(
        task.start,
        task.step,
        task.length,
      ).join(', ')}, __`,
      options: [],
    };
  }
  if (task.kind === 'expr_equivalence') {
    return {
      question: `Are ${fmtExpr(task.left)} and ${fmtExpr(task.right)} equal in value? (yes / no)`,
      options: ['yes', 'no'],
    };
  }
  if (task.kind === 'expr_equivalence_muldiv') {
    return {
      question: `Are ${fmtExprMulDiv(task.left)} and ${fmtExprMulDiv(task.right)} equal in value? (yes / no)`,
      options: ['yes', 'no'],
    };
  }
  if (task.kind === 'place_value_compose') {
    const tensLabel = `${task.tens} ${task.tens === 1 ? 'ten' : 'tens'}`;
    const onesLabel = `${task.ones} ${task.ones === 1 ? 'one' : 'ones'}`;
    return {
      question: `What number is ${tensLabel} and ${onesLabel}?`,
      options: [],
    };
  }
  if (task.kind === 'compose_hcto') {
    const hundredsLabel = `${task.hundreds} ${task.hundreds === 1 ? 'hundred' : 'hundreds'}`;
    const tensLabel = `${task.tens} ${task.tens === 1 ? 'ten' : 'tens'}`;
    const onesLabel = `${task.ones} ${task.ones === 1 ? 'one' : 'ones'}`;
    return {
      question: `What number is ${hundredsLabel}, ${tensLabel} and ${onesLabel}?`,
      options: [],
    };
  }
  if (task.kind === 'coin_value') {
    return {
      question: `How much is this altogether, in cents? ${fmtPieces(task.pieces)}. Type the total in cents.`,
      options: [],
    };
  }
  if (task.kind === 'number_representation_select') {
    const choices = task.options.map((o) => fmtRepOption(o));
    const numbered = choices.map((c, i) => `${i + 1}) ${c}`).join('  ');
    return {
      question: `Which one shows ${task.target}? ${numbered}. Type the number of your choice.`,
      options: choices,
    };
  }
  if (task.kind === 'positional_select') {
    const choices = task.options.map((o) => fmtScene(o));
    const numbered = choices.map((c, i) => `${i + 1}) ${c}`).join('  ');
    return {
      question: `Which picture shows the star ${RELATION_WORD[task.relation]} the box? ${numbered}. Type the number of your choice.`,
      options: choices,
    };
  }
  if (task.kind === 'graph_read_select') {
    const choices = task.categories.map((cat) => cat.label);
    const graph = task.categories.map((cat) => `${cat.label}: ${cat.count}`).join('  ');
    const numbered = choices.map((c, i) => `${i + 1}) ${c}`).join('  ');
    const word = task.mode === 'most' ? 'the most' : 'the fewest';
    return {
      question: `This graph shows ${graph}. Which has ${word}? ${numbered}. Type the number of your choice.`,
      options: choices,
    };
  }
  if (task.kind === 'shape_attribute_select') {
    const choices = task.options.map((o) => o.name);
    const numbered = choices.map((c, i) => `${i + 1}) ${c}`).join('  ');
    return {
      question: `Which shape has ${task.targetSides} sides? ${numbered}. Type the number of your choice.`,
      options: choices,
    };
  }
  if (task.kind === 'estimate_within_band') {
    return {
      question: `About how many are in this group? Give your best estimate, then you can check by counting.`,
      options: [],
    };
  }
  if (task.kind === 'round_whole') {
    const placeWord = task.place === 10 ? 'ten' : task.place === 100 ? 'hundred' : 'thousand';
    return {
      question: `Round ${task.value} to the nearest ${placeWord}.`,
      options: [] /* type the number */,
    };
  }
  if (task.kind === 'multidigit_multiplication') {
    return {
      question: `What is ${task.multiplicand} × ${task.multiplier}?`,
      options: [] /* type the number */,
    };
  }
  if (task.kind === 'division_with_remainder') {
    return {
      question: `What is ${task.dividend} ÷ ${task.divisor}? Give the quotient and the remainder, like "9 2".`,
      options: [] /* type "quotient remainder" */,
    };
  }
  if (task.kind === 'date_offset_select') {
    const choices = task.options.map((o) => fmtDate(o));
    const numbered = choices.map((c, i) => `${i + 1}) ${c}`).join('  ');
    const start = fmtDate({ month: task.month, day: task.day });
    return {
      question: `In ${task.year}, what date is ${task.offset} day${task.offset === 1 ? '' : 's'} after ${start}? ${numbered}. Type the number of your choice.`,
      options: choices,
    };
  }
  if (task.kind === 'code_reach_select') {
    const choices = task.options.map((p) => fmtProgram(p));
    const numbered = choices.map((c, i) => `${i + 1}) [${c}]`).join('  ');
    return {
      question: `On a ${task.rows}×${task.cols} grid the robot starts at row ${task.start.r}, col ${task.start.c} and must reach row ${task.goal.r}, col ${task.goal.c}. Which program gets it there? ${numbered}. Type the number of your choice.`,
      options: choices,
    };
  }
  if (task.kind === 'word_problem') {
    const ask = task.op === '+' ? 'How many are there now?' : 'How many are left?';
    return { question: `${task.scenario} ${ask} Type the number.`, options: [] };
  }
  if (task.kind === 'build_number') {
    return {
      question: `Build the number ${task.target} using tens and ones. Type how many tens and how many ones, like 2,4.`,
      options: [],
    };
  }
  if (task.kind === 'number_parity') {
    return { question: `Is ${task.n} even or odd? (even / odd)`, options: ['even', 'odd'] };
  }
  if (task.kind === 'calendar_next_day') {
    const when =
      task.offset === 1
        ? 'the next day'
        : task.offset === -1
          ? 'the day before'
          : `${Math.abs(task.offset)} days ${task.offset < 0 ? 'before' : 'after'}`;
    return {
      question: `If today is ${capitalize(task.day)}, what day is ${when}? Type the day.`,
      options: [],
    };
  }
  if (task.kind === 'fraction_partition') {
    return {
      question: `A whole is split into ${task.parts} equal parts; ${task.shaded} ${task.shaded === 1 ? 'is' : 'are'} shaded. Write the shaded amount as a fraction (a/b).`,
      options: [],
    };
  }
  if (task.kind === 'fraction_unit') {
    return {
      question: `A whole is split into ${task.denominator} equal parts. Write one part as a fraction (a/b).`,
      options: [],
    };
  }
  if (task.kind === 'fraction_nonunit_build') {
    return {
      question: `What fraction is ${task.count} copies of 1/${task.unitDenominator}? Write it as a/b.`,
      options: [],
    };
  }
  if (task.kind === 'fraction_number_line') {
    return {
      question: `On a number line from 0 to 1 split into ${task.intervals} equal steps, which step (0 to ${task.intervals}) is ${fmt(task.fraction)}? Type the step number.`,
      options: [],
    };
  }
  if (task.kind === 'fraction_order') {
    return {
      question: `Put these fractions in order from smallest to largest: ${task.fractions
        .map(fmt)
        .join(', ')}. Type their positions (1 = first shown) separated by commas, e.g. 2,1,3.`,
      options: [],
    };
  }
  if (task.kind === 'regular_past_tense') {
    return { question: `What is the past tense of "${task.verb}"? Type the word.`, options: [] };
  }
  if (task.kind === 'comparative_adjective') {
    return {
      question: `Write the comparative (the "-er" form) of "${task.adjective}". Type the word.`,
      options: [],
    };
  }
  return {
    question: `What is the plural of "${task.word}"? Type the word.`,
    options: [], // free text
  };
}

/** The reviewed answer KEY for a task — what the oracle validates before delivery. */
export function answerKeyValid(task: Task): boolean {
  if (task.kind === 'fraction_comparison') {
    return checkMathTask({
      kind: 'fraction_comparison',
      left: task.left,
      right: task.right,
      claimedAnswer: trueRelation(task.left, task.right),
    }).correct;
  }
  if (task.kind === 'fraction_equivalence') {
    return checkMathTask({
      kind: 'fraction_equivalence',
      left: task.left,
      right: task.right,
      claimedEquivalent: areEquivalent(task.left, task.right),
    }).correct;
  }
  if (task.kind === 'integer_addition') {
    return checkAdditionTask({
      kind: 'integer_addition',
      a: task.a,
      b: task.b,
      claimedSum: task.a + task.b,
    }).correct;
  }
  if (task.kind === 'integer_multiplication') {
    return checkMultiplicationTask({
      kind: 'integer_multiplication',
      a: task.a,
      b: task.b,
      claimedProduct: task.a * task.b,
    }).correct;
  }
  if (task.kind === 'integer_division') {
    return checkDivisionTask({
      kind: 'integer_division',
      dividend: task.dividend,
      divisor: task.divisor,
      claimedQuotient: task.dividend / task.divisor,
    }).correct;
  }
  if (task.kind === 'fractional_groups') {
    return checkFractionalGroupsTask({
      kind: 'fractional_groups',
      wholes: task.wholes,
      unitDenominator: task.unitDenominator,
      claimedCount: fractionalGroupCount(task.wholes, task.unitDenominator),
    }).correct;
  }
  if (task.kind === 'integer_subtraction') {
    return checkSubtractionTask({
      kind: 'integer_subtraction',
      a: task.a,
      b: task.b,
      claimedDifference: task.a - task.b,
    }).correct;
  }
  if (task.kind === 'integer_comparison') {
    return checkWholeNumberTask({
      kind: 'integer_comparison',
      a: task.a,
      b: task.b,
      claimedRelation: wholeRelation(task.a, task.b),
    }).correct;
  }
  if (task.kind === 'integer_ordering') {
    return checkWholeNumberTask({
      kind: 'integer_ordering',
      numbers: task.numbers,
      claimedOrder: correctWholeOrder(task.numbers),
    }).correct;
  }
  if (task.kind === 'skip_count_next') {
    return checkSkipCountTask({
      kind: 'skip_count_next',
      start: task.start,
      step: task.step,
      length: task.length,
      claimedNext: skipCountNext(task.start, task.step, task.length),
    }).correct;
  }
  if (task.kind === 'expr_equivalence') {
    return checkExprEquivalenceTask({
      kind: 'expr_equivalence',
      left: task.left,
      right: task.right,
      claimedEquivalent: evalExpr(task.left) === evalExpr(task.right),
    }).correct;
  }
  if (task.kind === 'expr_equivalence_muldiv') {
    return checkExprEquivalenceMulDivTask({
      kind: 'expr_equivalence_muldiv',
      left: task.left,
      right: task.right,
      claimedEquivalent: evalExprMulDiv(task.left) === evalExprMulDiv(task.right),
    }).correct;
  }
  if (task.kind === 'place_value_compose') {
    return checkComposeTask({
      kind: 'place_value_compose',
      tens: task.tens,
      ones: task.ones,
      claimedValue: composeValue(task.tens, task.ones),
    }).correct;
  }
  if (task.kind === 'compose_hcto') {
    return checkComposeHctoTask({
      kind: 'compose_hcto',
      hundreds: task.hundreds,
      tens: task.tens,
      ones: task.ones,
      claimedValue: composeHctoValue(task.hundreds, task.tens, task.ones),
    }).correct;
  }
  if (task.kind === 'coin_value') {
    return checkCoinValueTask({
      kind: 'coin_value',
      pieces: task.pieces,
      claimedTotalCents: coinTotalCents(task.pieces),
      maxTotalCents: coinValueCap(task),
    }).correct;
  }
  if (task.kind === 'number_representation_select') {
    // The content gate confirms the item is well-posed: exactly one option is
    // correct, and the oracle's own derived index validates against itself.
    return checkRepresentationSelectTask({
      kind: 'number_representation_select',
      target: task.target,
      options: task.options,
      claimedIndex: correctRepIndex(task),
    }).correct;
  }
  if (task.kind === 'positional_select') {
    return checkPositionalSelectTask({
      kind: 'positional_select',
      relation: task.relation,
      options: task.options,
      claimedIndex: correctPosIndex(task),
    }).correct;
  }
  if (task.kind === 'graph_read_select') {
    return checkGraphReadSelectTask({
      kind: 'graph_read_select',
      mode: task.mode,
      categories: task.categories,
      claimedIndex: correctDataIndex(task),
    }).correct;
  }
  if (task.kind === 'shape_attribute_select') {
    return checkShapeAttributeSelectTask({
      kind: 'shape_attribute_select',
      targetSides: task.targetSides,
      options: task.options,
      claimedIndex: correctShapeIndex(task),
    }).correct;
  }
  if (task.kind === 'calendar_next_day') {
    return checkCalendarTask({
      kind: 'calendar_next_day',
      day: task.day,
      offset: task.offset,
      claimedDay: dayAfter(task.day, task.offset) ?? '',
    }).correct;
  }
  if (task.kind === 'estimate_within_band') {
    // The content gate confirms the reviewed band is well-posed and brackets
    // the true count; a mid-band value validates it against itself.
    return checkEstimateTask({
      kind: 'estimate_within_band',
      actual: task.actual,
      low: task.low,
      high: task.high,
      claimed: task.actual,
    }).correct;
  }
  if (task.kind === 'round_whole') {
    return checkRoundWholeTask({
      kind: 'round_whole',
      value: task.value,
      place: task.place,
      claimedRounded: roundToPlace(task.value, task.place),
    }).correct;
  }
  if (task.kind === 'multidigit_multiplication') {
    return checkMultidigitMultiplicationTask({
      kind: 'multidigit_multiplication',
      multiplicand: task.multiplicand,
      multiplier: task.multiplier,
      claimedProduct: task.multiplicand * task.multiplier,
    }).correct;
  }
  if (task.kind === 'division_with_remainder') {
    return checkDivisionRemainderTask({
      kind: 'division_with_remainder',
      dividend: task.dividend,
      divisor: task.divisor,
      claimedQuotient: Math.floor(task.dividend / task.divisor),
      claimedRemainder: task.dividend % task.divisor,
    }).correct;
  }
  if (task.kind === 'date_offset_select') {
    return checkDateOffsetSelectTask({
      kind: 'date_offset_select',
      year: task.year,
      month: task.month,
      day: task.day,
      offset: task.offset,
      options: task.options,
      claimedIndex: correctDateOffsetIndex(task),
    }).correct;
  }
  if (task.kind === 'code_reach_select') {
    return checkCodeReachSelectTask({
      kind: 'code_reach_select',
      rows: task.rows,
      cols: task.cols,
      start: task.start,
      goal: task.goal,
      options: task.options,
      claimedIndex: correctCodeIndex(task),
    }).correct;
  }
  if (task.kind === 'word_problem') {
    return checkWordProblemTask({
      kind: 'word_problem',
      a: task.a,
      b: task.b,
      op: task.op,
      claimed: wordProblemResult(task.a, task.op, task.b) ?? -1,
    }).correct;
  }
  if (task.kind === 'build_number') {
    // A canonical build (standard tens/ones) validates the well-posed target.
    return checkBuildNumberTask({
      kind: 'build_number',
      target: task.target,
      tens: Math.floor(task.target / 10),
      ones: task.target % 10,
    }).correct;
  }
  if (task.kind === 'number_parity') {
    return checkParityTask({ kind: 'number_parity', n: task.n, claimed: parityOf(task.n) }).correct;
  }
  if (task.kind === 'fraction_partition') {
    return checkMathTask({
      kind: 'fraction_partition',
      parts: task.parts,
      shaded: task.shaded,
      claimedFraction: f(task.shaded, task.parts),
    }).correct;
  }
  if (task.kind === 'fraction_unit') {
    return checkMathTask({
      kind: 'fraction_unit',
      denominator: task.denominator,
      claimedUnit: f(1, task.denominator),
    }).correct;
  }
  if (task.kind === 'fraction_nonunit_build') {
    return checkMathTask({
      kind: 'fraction_nonunit_build',
      count: task.count,
      unitDenominator: task.unitDenominator,
      claimedFraction: f(task.count, task.unitDenominator),
    }).correct;
  }
  if (task.kind === 'fraction_number_line') {
    return checkMathTask({
      kind: 'fraction_number_line',
      fraction: task.fraction,
      intervals: task.intervals,
      claimedTick: correctTick(task),
    }).correct;
  }
  if (task.kind === 'fraction_order') {
    return checkMathTask({
      kind: 'fraction_order',
      fractions: task.fractions,
      claimedOrder: correctOrder(task.fractions),
    }).correct;
  }
  if (task.kind === 'regular_past_tense') {
    return checkEnglishTask({
      kind: 'regular_past_tense',
      verb: task.verb,
      claimedPast: pastTenseRegular(task.verb),
    }).correct;
  }
  if (task.kind === 'comparative_adjective') {
    return checkEnglishTask({
      kind: 'comparative_adjective',
      adjective: task.adjective,
      claimedComparative: comparativeRegular(task.adjective),
    }).correct;
  }
  return checkEnglishTask({
    kind: 'noun_plural',
    word: task.word,
    claimedPlural: pluralize(task.word),
  }).correct;
}

/** Is a raw learner answer a well-formed token for this task's kind? */
export function tokenValid(task: Task, raw: string): boolean {
  const a = raw.trim().toLowerCase();
  if (task.kind === 'fraction_comparison') return isRelation(a);
  if (task.kind === 'fraction_equivalence') return a === 'yes' || a === 'no';
  if (task.kind === 'integer_addition') return /^\d+$/.test(a); // a non-negative integer
  if (task.kind === 'integer_multiplication') return /^\d+$/.test(a); // a non-negative integer
  if (task.kind === 'integer_division') return /^\d+$/.test(a); // a non-negative integer
  if (task.kind === 'fractional_groups') return /^\d+$/.test(a); // a non-negative integer count
  if (task.kind === 'integer_subtraction') return /^\d+$/.test(a); // a non-negative integer
  if (task.kind === 'integer_comparison') return isRelation(a);
  if (task.kind === 'integer_ordering') {
    return new RegExp(`^\\d+(,\\d+){${task.numbers.length - 1}}$`).test(a.replace(/\s+/g, ''));
  }
  if (task.kind === 'skip_count_next') return /^\d+$/.test(a); // a non-negative integer
  if (task.kind === 'expr_equivalence') return a === 'yes' || a === 'no';
  if (task.kind === 'expr_equivalence_muldiv') return a === 'yes' || a === 'no';
  if (task.kind === 'place_value_compose') return /^\d+$/.test(a); // a non-negative integer
  if (task.kind === 'compose_hcto') return /^\d+$/.test(a); // a non-negative integer
  if (task.kind === 'coin_value') return /^\d+$/.test(a); // a total in cents
  if (task.kind === 'number_representation_select' || task.kind === 'positional_select') {
    if (!/^\d+$/.test(a)) return false; // a 1-based option number
    const n = Number(a);
    return n >= 1 && n <= task.options.length;
  }
  if (task.kind === 'graph_read_select') {
    if (!/^\d+$/.test(a)) return false; // a 1-based category number
    const n = Number(a);
    return n >= 1 && n <= task.categories.length;
  }
  if (task.kind === 'shape_attribute_select') {
    if (!/^\d+$/.test(a)) return false; // a 1-based option number
    const n = Number(a);
    return n >= 1 && n <= task.options.length;
  }
  if (task.kind === 'calendar_next_day') return /^[a-z]+$/.test(a); // a day name
  if (task.kind === 'estimate_within_band') return /^\d+$/.test(a); // a non-negative estimate
  if (task.kind === 'round_whole') return /^\d+$/.test(a); // a non-negative integer
  if (task.kind === 'multidigit_multiplication') return /^\d+$/.test(a); // a non-negative integer
  if (task.kind === 'division_with_remainder') return parseQuotientRemainder(a) !== null; // "q r"
  if (task.kind === 'date_offset_select' || task.kind === 'code_reach_select') {
    if (!/^\d+$/.test(a)) return false; // a 1-based option number
    const n = Number(a);
    return n >= 1 && n <= task.options.length;
  }
  if (task.kind === 'word_problem') return /^\d+$/.test(a); // a non-negative answer
  if (task.kind === 'build_number') return /^\d+,\d+$/.test(a.replace(/\s+/g, '')); // tens,ones
  if (task.kind === 'number_parity') return a === 'even' || a === 'odd';
  if (
    task.kind === 'fraction_partition' ||
    task.kind === 'fraction_unit' ||
    task.kind === 'fraction_nonunit_build'
  ) {
    return /^\d+\/\d+$/.test(a); // a fraction token a/b
  }
  if (task.kind === 'fraction_number_line') return /^\d+$/.test(a); // a step index
  if (task.kind === 'fraction_order') {
    return new RegExp(`^\\d+(,\\d+){${task.fractions.length - 1}}$`).test(a.replace(/\s+/g, ''));
  }
  return /^[a-z]+$/.test(a); // a single word
}

/** Grade a well-formed answer with the independent oracle (token must be valid). */
export function judge(task: Task, raw: string): boolean {
  const a = raw.trim().toLowerCase();
  if (task.kind === 'fraction_comparison') {
    return checkMathTask({
      kind: 'fraction_comparison',
      left: task.left,
      right: task.right,
      claimedAnswer: a as FractionRelation,
    }).correct;
  }
  if (task.kind === 'fraction_equivalence') {
    return checkMathTask({
      kind: 'fraction_equivalence',
      left: task.left,
      right: task.right,
      claimedEquivalent: a === 'yes',
    }).correct;
  }
  if (task.kind === 'integer_addition') {
    return checkAdditionTask({
      kind: 'integer_addition',
      a: task.a,
      b: task.b,
      claimedSum: Number(a),
    }).correct;
  }
  if (task.kind === 'integer_multiplication') {
    return checkMultiplicationTask({
      kind: 'integer_multiplication',
      a: task.a,
      b: task.b,
      claimedProduct: Number(a),
    }).correct;
  }
  if (task.kind === 'integer_division') {
    return checkDivisionTask({
      kind: 'integer_division',
      dividend: task.dividend,
      divisor: task.divisor,
      claimedQuotient: Number(a),
    }).correct;
  }
  if (task.kind === 'fractional_groups') {
    return checkFractionalGroupsTask({
      kind: 'fractional_groups',
      wholes: task.wholes,
      unitDenominator: task.unitDenominator,
      claimedCount: Number(a),
    }).correct;
  }
  if (task.kind === 'integer_subtraction') {
    return checkSubtractionTask({
      kind: 'integer_subtraction',
      a: task.a,
      b: task.b,
      claimedDifference: Number(a),
    }).correct;
  }
  if (task.kind === 'integer_comparison') {
    return checkWholeNumberTask({
      kind: 'integer_comparison',
      a: task.a,
      b: task.b,
      claimedRelation: a as WholeRelation,
    }).correct;
  }
  if (task.kind === 'integer_ordering') {
    return checkWholeNumberTask({
      kind: 'integer_ordering',
      numbers: task.numbers,
      claimedOrder: parseOrder(a),
    }).correct;
  }
  if (task.kind === 'skip_count_next') {
    return checkSkipCountTask({
      kind: 'skip_count_next',
      start: task.start,
      step: task.step,
      length: task.length,
      claimedNext: Number(a),
    }).correct;
  }
  if (task.kind === 'expr_equivalence') {
    return checkExprEquivalenceTask({
      kind: 'expr_equivalence',
      left: task.left,
      right: task.right,
      claimedEquivalent: a === 'yes',
    }).correct;
  }
  if (task.kind === 'expr_equivalence_muldiv') {
    return checkExprEquivalenceMulDivTask({
      kind: 'expr_equivalence_muldiv',
      left: task.left,
      right: task.right,
      claimedEquivalent: a === 'yes',
    }).correct;
  }
  if (task.kind === 'place_value_compose') {
    return checkComposeTask({
      kind: 'place_value_compose',
      tens: task.tens,
      ones: task.ones,
      claimedValue: Number(a),
    }).correct;
  }
  if (task.kind === 'compose_hcto') {
    return checkComposeHctoTask({
      kind: 'compose_hcto',
      hundreds: task.hundreds,
      tens: task.tens,
      ones: task.ones,
      claimedValue: Number(a),
    }).correct;
  }
  if (task.kind === 'coin_value') {
    return checkCoinValueTask({
      kind: 'coin_value',
      pieces: task.pieces,
      claimedTotalCents: Number(a),
      maxTotalCents: coinValueCap(task),
    }).correct;
  }
  if (task.kind === 'number_representation_select') {
    // The child's answer is a 1-based option number → 0-based claimedIndex.
    return checkRepresentationSelectTask({
      kind: 'number_representation_select',
      target: task.target,
      options: task.options,
      claimedIndex: Number(a) - 1,
    }).correct;
  }
  if (task.kind === 'positional_select') {
    return checkPositionalSelectTask({
      kind: 'positional_select',
      relation: task.relation,
      options: task.options,
      claimedIndex: Number(a) - 1,
    }).correct;
  }
  if (task.kind === 'graph_read_select') {
    return checkGraphReadSelectTask({
      kind: 'graph_read_select',
      mode: task.mode,
      categories: task.categories,
      claimedIndex: Number(a) - 1,
    }).correct;
  }
  if (task.kind === 'shape_attribute_select') {
    return checkShapeAttributeSelectTask({
      kind: 'shape_attribute_select',
      targetSides: task.targetSides,
      options: task.options,
      claimedIndex: Number(a) - 1,
    }).correct;
  }
  if (task.kind === 'calendar_next_day') {
    return checkCalendarTask({
      kind: 'calendar_next_day',
      day: task.day,
      offset: task.offset,
      claimedDay: a,
    }).correct;
  }
  if (task.kind === 'estimate_within_band') {
    return checkEstimateTask({
      kind: 'estimate_within_band',
      actual: task.actual,
      low: task.low,
      high: task.high,
      claimed: Number(a),
    }).correct;
  }
  if (task.kind === 'round_whole') {
    return checkRoundWholeTask({
      kind: 'round_whole',
      value: task.value,
      place: task.place,
      claimedRounded: Number(a),
    }).correct;
  }
  if (task.kind === 'multidigit_multiplication') {
    return checkMultidigitMultiplicationTask({
      kind: 'multidigit_multiplication',
      multiplicand: task.multiplicand,
      multiplier: task.multiplier,
      claimedProduct: Number(a),
    }).correct;
  }
  if (task.kind === 'division_with_remainder') {
    const parsed = parseQuotientRemainder(a);
    if (!parsed) return false;
    return checkDivisionRemainderTask({
      kind: 'division_with_remainder',
      dividend: task.dividend,
      divisor: task.divisor,
      claimedQuotient: parsed.q,
      claimedRemainder: parsed.r,
    }).correct;
  }
  if (task.kind === 'date_offset_select') {
    return checkDateOffsetSelectTask({
      kind: 'date_offset_select',
      year: task.year,
      month: task.month,
      day: task.day,
      offset: task.offset,
      options: task.options,
      claimedIndex: Number(a) - 1,
    }).correct;
  }
  if (task.kind === 'code_reach_select') {
    return checkCodeReachSelectTask({
      kind: 'code_reach_select',
      rows: task.rows,
      cols: task.cols,
      start: task.start,
      goal: task.goal,
      options: task.options,
      claimedIndex: Number(a) - 1,
    }).correct;
  }
  if (task.kind === 'word_problem') {
    return checkWordProblemTask({
      kind: 'word_problem',
      a: task.a,
      b: task.b,
      op: task.op,
      claimed: Number(a),
    }).correct;
  }
  if (task.kind === 'build_number') {
    const [t, o] = a.replace(/\s+/g, '').split(',');
    return checkBuildNumberTask({
      kind: 'build_number',
      target: task.target,
      tens: Number(t),
      ones: Number(o),
    }).correct;
  }
  if (task.kind === 'number_parity') {
    return checkParityTask({ kind: 'number_parity', n: task.n, claimed: a as Parity }).correct;
  }
  if (task.kind === 'fraction_partition') {
    const cf = parseFrac(a);
    return cf
      ? checkMathTask({
          kind: 'fraction_partition',
          parts: task.parts,
          shaded: task.shaded,
          claimedFraction: cf,
        }).correct
      : false;
  }
  if (task.kind === 'fraction_unit') {
    const cf = parseFrac(a);
    return cf
      ? checkMathTask({ kind: 'fraction_unit', denominator: task.denominator, claimedUnit: cf })
          .correct
      : false;
  }
  if (task.kind === 'fraction_nonunit_build') {
    const cf = parseFrac(a);
    return cf
      ? checkMathTask({
          kind: 'fraction_nonunit_build',
          count: task.count,
          unitDenominator: task.unitDenominator,
          claimedFraction: cf,
        }).correct
      : false;
  }
  if (task.kind === 'fraction_number_line') {
    return checkMathTask({
      kind: 'fraction_number_line',
      fraction: task.fraction,
      intervals: task.intervals,
      claimedTick: Number(a),
    }).correct;
  }
  if (task.kind === 'fraction_order') {
    return checkMathTask({
      kind: 'fraction_order',
      fractions: task.fractions,
      claimedOrder: parseOrder(a),
    }).correct;
  }
  if (task.kind === 'regular_past_tense') {
    return checkEnglishTask({ kind: 'regular_past_tense', verb: task.verb, claimedPast: a })
      .correct;
  }
  if (task.kind === 'comparative_adjective') {
    return checkEnglishTask({
      kind: 'comparative_adjective',
      adjective: task.adjective,
      claimedComparative: a,
    }).correct;
  }
  return checkEnglishTask({ kind: 'noun_plural', word: task.word, claimedPlural: a }).correct;
}

/** The oracle's ground-truth answer token for a task — the canonical correct
 *  response `judge` accepts. Deterministic; used by diagnostics and tests to
 *  answer a (possibly generated) item without hardcoding per-item values. */
export function correctAnswerFor(task: Task): string {
  switch (task.kind) {
    case 'fraction_comparison':
      return trueRelation(task.left, task.right);
    case 'fraction_equivalence':
      return areEquivalent(task.left, task.right) ? 'yes' : 'no';
    case 'integer_addition':
      return String(task.a + task.b);
    case 'integer_multiplication':
      return String(task.a * task.b);
    case 'integer_division':
      return String(task.dividend / task.divisor);
    case 'fractional_groups':
      return String(fractionalGroupCount(task.wholes, task.unitDenominator));
    case 'integer_subtraction':
      return String(task.a - task.b);
    case 'integer_comparison':
      return wholeRelation(task.a, task.b);
    case 'integer_ordering':
      return correctWholeOrder(task.numbers)
        .map((i) => i + 1)
        .join(',');
    case 'skip_count_next':
      return String(skipCountNext(task.start, task.step, task.length));
    case 'expr_equivalence':
      return evalExpr(task.left) === evalExpr(task.right) ? 'yes' : 'no';
    case 'expr_equivalence_muldiv':
      return evalExprMulDiv(task.left) === evalExprMulDiv(task.right) ? 'yes' : 'no';
    case 'place_value_compose':
      return String(composeValue(task.tens, task.ones));
    case 'compose_hcto':
      return String(composeHctoValue(task.hundreds, task.tens, task.ones));
    case 'coin_value':
      return String(coinTotalCents(task.pieces));
    case 'number_representation_select':
      // The 1-based number of the option the oracle derives as correct.
      return String(correctRepIndex(task) + 1);
    case 'positional_select':
      return String(correctPosIndex(task) + 1);
    case 'graph_read_select':
      return String(correctDataIndex(task) + 1);
    case 'shape_attribute_select':
      return String(correctShapeIndex(task) + 1);
    case 'calendar_next_day':
      return dayAfter(task.day, task.offset) ?? '';
    case 'estimate_within_band':
      // A canonical in-band answer (the true count sits inside the reviewed band).
      return String(task.actual);
    case 'round_whole':
      return String(roundToPlace(task.value, task.place));
    case 'multidigit_multiplication':
      return String(task.multiplicand * task.multiplier);
    case 'division_with_remainder':
      return `${Math.floor(task.dividend / task.divisor)} ${task.dividend % task.divisor}`;
    case 'date_offset_select':
      return String(correctDateOffsetIndex(task) + 1);
    case 'code_reach_select':
      return String(correctCodeIndex(task) + 1);
    case 'word_problem':
      return String(wordProblemResult(task.a, task.op, task.b) ?? 0);
    case 'build_number':
      // The standard build (tens and ones of the target) — one valid answer.
      return `${Math.floor(task.target / 10)},${task.target % 10}`;
    case 'number_parity':
      return parityOf(task.n);
    case 'fraction_partition':
      return `${task.shaded}/${task.parts}`;
    case 'fraction_unit':
      return `1/${task.denominator}`;
    case 'fraction_nonunit_build':
      return `${task.count}/${task.unitDenominator}`;
    case 'fraction_number_line':
      return String(correctTick(task));
    case 'fraction_order':
      return correctOrder(task.fractions)
        .map((i) => i + 1)
        .join(',');
    case 'regular_past_tense':
      return pastTenseRegular(task.verb);
    case 'comparative_adjective':
      return comparativeRegular(task.adjective);
    case 'noun_plural':
      return pluralize(task.word);
  }
}

/**
 * A valid-but-incorrect answer token for a task — one `tokenValid` accepts and
 * `judge` grades wrong. Deterministic; used by diagnostics/tests to drive a
 * known-wrong turn on a (possibly generated) item without hardcoding per-item
 * values. (A token that is merely malformed would be refused, not graded wrong.)
 */
export function wrongAnswerFor(task: Task): string {
  switch (task.kind) {
    case 'fraction_comparison':
      return trueRelation(task.left, task.right) === 'lt' ? 'gt' : 'lt';
    case 'fraction_equivalence':
      return areEquivalent(task.left, task.right) ? 'no' : 'yes';
    case 'integer_addition':
      return String(task.a + task.b + 1);
    case 'integer_multiplication': {
      // The adds-instead-of-multiplies error (a + b) — the real misconception.
      // Fall back to one-off on the a·b === a+b edge (e.g. 2×2) so it is always wrong.
      const product = task.a * task.b;
      const sum = task.a + task.b;
      return String(sum === product ? product + 1 : sum);
    }
    case 'integer_division': {
      // The subtracts-instead-of-divides error (dividend - divisor) — the real
      // misconception. Fall back to one-off if that coincides with the quotient
      // or is negative, so the "wrong" answer is always a valid, wrong token.
      const quotient = task.dividend / task.divisor;
      const subtracted = task.dividend - task.divisor;
      return String(subtracted === quotient || subtracted < 0 ? quotient + 1 : subtracted);
    }
    case 'fractional_groups':
      // The counts-the-wholes error — gives the number of wholes, ignoring that
      // each splits into unitDenominator pieces (wrong whenever the denominator
      // is ≥ 2, which the oracle requires).
      return String(task.wholes);
    case 'integer_subtraction':
      // A valid non-negative integer that is one off the true difference; when the
      // difference is 0 the only other non-negative token is 1 (never negative).
      return String(task.a - task.b === 0 ? 1 : task.a - task.b + 1);
    case 'integer_comparison':
      // Any relation other than the true one (eq → lt is wrong too).
      return wholeRelation(task.a, task.b) === 'lt' ? 'gt' : 'lt';
    case 'integer_ordering':
      // Reverse of the correct ascending order — wrong whenever the values are
      // not all equal (the static bank items are always distinct).
      return correctWholeOrder(task.numbers)
        .map((i) => i + 1)
        .reverse()
        .join(',');
    case 'skip_count_next':
      // One past the true next term — a valid integer the oracle grades wrong
      // for every allowed step (an "overshoot by one" slip).
      return String(skipCountNext(task.start, task.step, task.length) + 1);
    case 'expr_equivalence':
      return evalExpr(task.left) === evalExpr(task.right) ? 'no' : 'yes';
    case 'expr_equivalence_muldiv':
      return evalExprMulDiv(task.left) === evalExprMulDiv(task.right) ? 'no' : 'yes';
    case 'place_value_compose':
      // One off the composed value — a valid integer the oracle grades wrong.
      return String(composeValue(task.tens, task.ones) + 1);
    case 'compose_hcto': {
      // The add-the-counts place-value error (hundreds+tens+ones) — the real
      // misconception. Fall back to one-off if a tiny item makes the sum equal
      // the true value, so the "wrong" answer is always actually wrong.
      const hctoValue = composeHctoValue(task.hundreds, task.tens, task.ones);
      const counts = task.hundreds + task.tens + task.ones;
      return String(counts === hctoValue ? hctoValue + 1 : counts);
    }
    case 'coin_value':
      // The "count the pieces instead of their value" error — the number of
      // coins, which is wrong whenever any piece is worth more than 1¢ (always).
      return String(task.pieces.length);
    case 'number_representation_select': {
      // A valid option number that is NOT the correct one (a distractor pick).
      const correct = correctRepIndex(task);
      const wrong = task.options.findIndex((_, i) => i !== correct);
      return String((wrong === -1 ? correct : wrong) + 1);
    }
    case 'positional_select': {
      const correct = correctPosIndex(task);
      const wrong = task.options.findIndex((_, i) => i !== correct);
      return String((wrong === -1 ? correct : wrong) + 1);
    }
    case 'graph_read_select': {
      const correct = correctDataIndex(task);
      const wrong = task.categories.findIndex((_, i) => i !== correct);
      return String((wrong === -1 ? correct : wrong) + 1);
    }
    case 'shape_attribute_select': {
      const correct = correctShapeIndex(task);
      const wrong = task.options.findIndex((_, i) => i !== correct);
      return String((wrong === -1 ? correct : wrong) + 1);
    }
    case 'calendar_next_day':
      // The adjacent day — a valid weekday the oracle grades wrong.
      return dayAfter(task.day, task.offset + 1) ?? 'monday';
    case 'estimate_within_band':
      // Just outside the reviewed band — a valid integer graded wrong.
      return String(task.high + 1);
    case 'round_whole': {
      // The truncate-instead-of-round error (drop the lower digits). Fall back to
      // one place up if the value already sits on a multiple, so it is always wrong.
      const rounded = roundToPlace(task.value, task.place);
      const truncated = Math.floor(task.value / task.place) * task.place;
      return String(truncated === rounded ? rounded + task.place : truncated);
    }
    case 'multidigit_multiplication': {
      // The multiplies-only-the-ones-digit error. Fall back to one-off if the
      // multiplicand is single-digit (so the ones-only product equals the true
      // one), keeping the "wrong" answer always wrong.
      const product = task.multiplicand * task.multiplier;
      const onesOnly = (task.multiplicand % 10) * task.multiplier;
      return String(onesOnly === product ? product + task.multiplier : onesOnly);
    }
    case 'division_with_remainder': {
      // The drops-the-remainder error — right quotient, remainder reported as 0.
      // Fall back to a wrong quotient when the true remainder is already 0, so
      // the "wrong" answer is always actually wrong.
      const q = Math.floor(task.dividend / task.divisor);
      const r = task.dividend % task.divisor;
      return r === 0 ? `${q + 1} 0` : `${q} 0`;
    }
    case 'date_offset_select': {
      const correct = correctDateOffsetIndex(task);
      const wrong = task.options.findIndex((_, i) => i !== correct);
      return String((wrong === -1 ? correct : wrong) + 1);
    }
    case 'code_reach_select': {
      const correct = correctCodeIndex(task);
      const wrong = task.options.findIndex((_, i) => i !== correct);
      return String((wrong === -1 ? correct : wrong) + 1);
    }
    case 'word_problem':
      // The wrong-operation slip: compute with the opposite operation (clamped
      // to a valid non-negative token), a classic word-problem error.
      return String(Math.abs(task.op === '+' ? task.a - task.b : task.a + task.b));
    case 'build_number':
      // A build that is one ten too many — a valid token the oracle grades wrong.
      return `${Math.floor(task.target / 10) + 1},${task.target % 10}`;
    case 'number_parity':
      return parityOf(task.n) === 'even' ? 'odd' : 'even';
    case 'fraction_partition':
      return `${task.shaded === 0 ? 1 : 0}/${task.parts}`;
    case 'fraction_unit':
      return `2/${task.denominator}`;
    case 'fraction_nonunit_build':
      return task.count > 1
        ? `1/${task.unitDenominator}`
        : `${task.count + 1}/${task.unitDenominator}`;
    case 'fraction_number_line':
      return correctTick(task) === 0 ? '1' : '0';
    case 'fraction_order':
      return correctOrder(task.fractions)
        .map((i) => i + 1)
        .reverse()
        .join(',');
    case 'regular_past_tense':
      return task.verb;
    case 'comparative_adjective':
      return task.adjective;
    case 'noun_plural':
      return task.word;
  }
}

/**
 * ============================================================================
 *  Generated-item provider — the deterministic item stream in the live loop
 * ============================================================================
 * The task layer serves two kinds of task id:
 *   - a static TASK_BANK key (e.g. "frac-cmp-1"), or
 *   - a GENERATED id "gen:<skillId>:<seed>:<difficulty>:<index>".
 * A generated id fully determines its item (the generators are seeded and pure),
 * so `resolveTask` reconstructs the exact item for grading WITHOUT any stored
 * state — the task→answer round-trip stays keyed by id, as before. Only the
 * skills whose answer the loop already knows how to present and grade are servable
 * this way (fraction compare/equivalence, regular plurals); an id for any other
 * generated kind is refused, never faked. Every resolved task still passes the
 * same content gate below.
 */

/** Skills the coaching/diagnostic loop can serve generated items for today, with
 *  the session course each belongs to. Other generatable skills (the remaining
 *  fraction kinds, English past/comparative) need a presentation/course binding
 *  first and are intentionally NOT servable yet. */
export const GEN_SERVABLE: Readonly<Record<string, { subject: Subject; course: Task['course'] }>> =
  {
    [COMPARE]: { subject: 'math', course: 'fractions' },
    [EQUIV]: { subject: 'math', course: 'fractions' },
    [PARTITION]: { subject: 'math', course: 'fractions' },
    [UNIT]: { subject: 'math', course: 'fractions' },
    [NONUNIT]: { subject: 'math', course: 'fractions' },
    [NUMBERLINE]: { subject: 'math', course: 'fractions' },
    [ORDER]: { subject: 'math', course: 'fractions' },
    [PLURAL_BASE]: { subject: 'english', course: 'plurals' },
    [PLURAL_SIB]: { subject: 'english', course: 'plurals' },
    [PAST]: { subject: 'english', course: 'past-tense' },
    [COMP]: { subject: 'english', course: 'comparative' },
  };

/** Stable 32-bit seed from a session id so a session's generated stream is
 *  reproducible (and graded deterministically) without storing the items. */
export function seedFromSession(sessionId: string): number {
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < sessionId.length; i++) {
    h ^= sessionId.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** The generated task id for a skill at a given stream index. */
export function generatedTaskId(
  skillId: string,
  index: number,
  seed: number,
  difficulty: Difficulty = 'core',
): string {
  return `gen:${skillId}:${seed}:${difficulty}:${index}`;
}

/** The difficulty slot value that marks a generated item as a NOVEL-context
 *  transfer probe (resolved as a `stretch` item, graded as a transfer_check). */
export const TRANSFER_MARKER = 'transfer';

/** A generated transfer-probe id for a skill — a novel-context item the loop grades
 *  as transfer_check so a correct answer can lift a mastered skill to TRANSFERABLE. */
export function generatedTransferTaskId(skillId: string, index: number, seed: number): string {
  return `gen:${skillId}:${seed}:${TRANSFER_MARKER}:${index}`;
}

const isGeneratedId = (taskId: string): boolean => taskId.startsWith('gen:');

/** True when a turn on this task id must be recorded as a transfer_check — a static
 *  transfer item (TRANSFER_TASKS) or a generated id carrying the transfer marker. */
export function isTransferTask(taskId: string): boolean {
  if (TRANSFER_TASKS.has(taskId)) return true;
  if (!isGeneratedId(taskId)) return false;
  const parts = taskId.split(':'); // gen : skillId : seed : difficulty : index
  return parts.length === 5 && parts[3] === TRANSFER_MARKER;
}

/** Reconstruct a generated item as a gradable Task. Pure/deterministic from the id. */
function resolveGeneratedTask(taskId: string): Task {
  const parts = taskId.split(':'); // gen : skillId : seed : difficulty : index
  if (parts.length !== 5) throw new DomainError('NOT_FOUND', 'malformed generated task id');
  const [, skillId, seedStr, difficulty, indexStr] = parts as [
    string,
    string,
    string,
    string,
    string,
  ];
  const servable = GEN_SERVABLE[skillId];
  if (!servable) throw new DomainError('POLICY_BLOCKED', 'skill is not servable in the loop yet');
  const seed = Number(seedStr);
  const index = Number(indexStr);
  if (!Number.isInteger(seed) || !Number.isInteger(index) || index < 0) {
    throw new DomainError('NOT_FOUND', 'malformed generated task id');
  }
  // The `transfer` marker denotes a NOVEL-context item (AT-12): it is generated at
  // the hardest `stretch` tier so it is a genuinely different item from the `core`
  // practice stream, and the loop grades it as a transfer_check (see isTransferTask).
  if (
    difficulty !== 'intro' &&
    difficulty !== 'core' &&
    difficulty !== 'stretch' &&
    difficulty !== TRANSFER_MARKER
  ) {
    throw new DomainError('NOT_FOUND', 'malformed generated task id');
  }
  const d: Difficulty = difficulty === TRANSFER_MARKER ? 'stretch' : difficulty;

  if (servable.subject === 'math') {
    // The generator yields a finite DISTINCT pool per skill/difficulty. When the
    // requested index runs past it (e.g. the diagnostic re-probes one skill more
    // times than it has distinct items), cycle within the pool deterministically
    // rather than failing to deliver — the same id always resolves to the same
    // item, and no deliverable turn 404s on an exhausted pool.
    const pool = generateItems(skillId, index + 1, seed, d);
    const item = pool[index] ?? (pool.length > 0 ? pool[index % pool.length] : undefined);
    if (!item) throw new DomainError('NOT_FOUND', 'generated item index out of range');
    if (item.task.kind === 'fraction_comparison') return cmp(item.task.left, item.task.right);
    if (item.task.kind === 'fraction_equivalence') return eq(item.task.left, item.task.right);
    if (item.task.kind === 'fraction_partition')
      return partition(item.task.parts, item.task.shaded);
    if (item.task.kind === 'fraction_unit') return unit(item.task.denominator);
    if (item.task.kind === 'fraction_nonunit_build')
      return nonunit(item.task.count, item.task.unitDenominator);
    if (item.task.kind === 'fraction_number_line')
      return numberline(item.task.fraction, item.task.intervals);
    if (item.task.kind === 'fraction_order') return order(item.task.fractions);
    throw new DomainError('POLICY_BLOCKED', 'generated math kind not servable in the loop yet');
  }
  const enPool = generateEnglishItems(skillId, index + 1, seed, d);
  const item = enPool[index] ?? (enPool.length > 0 ? enPool[index % enPool.length] : undefined);
  if (!item) throw new DomainError('NOT_FOUND', 'generated item index out of range');
  if (item.task.kind === 'noun_plural') {
    return plural(skillId as PluralTask['skillId'], item.task.word);
  }
  if (item.task.kind === 'regular_past_tense') return pastTask(item.task.verb);
  if (item.task.kind === 'comparative_adjective') return compTask(item.task.adjective);
  throw new DomainError('POLICY_BLOCKED', 'generated english kind not servable in the loop yet');
}

/** Resolve any task id — static bank or generated — to a gradable Task. */
export function resolveTask(taskId: string): Task {
  if (isGeneratedId(taskId)) return resolveGeneratedTask(taskId);
  const task = TASK_BANK[taskId];
  if (!task) throw new DomainError('NOT_FOUND', 'task not found');
  return task;
}

/**
 * Run the content gate for a task before it reaches a child: its answer key is
 * validated by the subject's INDEPENDENT oracle (AI-001). Throws if the task is
 * unknown or fails validation; returns the task otherwise. Works for both static
 * and generated ids (a generated id is reconstructed deterministically first).
 */
export function gateTask(taskId: string): Task {
  const task = resolveTask(taskId);
  const generatorId = isGeneratedId(taskId)
    ? `item-gen:${task.subject}`
    : `content-author:${task.subject}-bank`;
  const record = validateCandidate({
    candidateId: `task:${taskId}`,
    generatorId,
    validatorId: `oracle:${task.subject}`,
    validatorVersion: 'v1',
    math: { ran: true, correct: answerKeyValid(task) },
    safety: { available: true, pass: true },
    onTopic: true,
  });
  const candidate: CandidateContent = {
    candidateId: record.candidateId,
    verdict: record.verdict,
    validationRecordRef: validationRecordRef(record),
  };
  const delivery = decideDelivery(candidate, null);
  if (delivery.kind !== 'DELIVER') {
    throw new DomainError('POLICY_BLOCKED', 'task failed validation; not delivered');
  }
  return task;
}
