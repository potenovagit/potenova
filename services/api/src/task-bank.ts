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
  checkDecimalCompareTask,
  decimalRelation,
  formatTenths,
  checkDecimalRoundTask,
  roundTenthsToWhole,
  checkFractionDecimalEquivTask,
  type DecimalRelation,
  checkRectangleAreaTask,
  rectangleArea,
  checkRectangleMissingSideTask,
  checkDecimalHundredthCompareTask,
  hundredthsRelation,
  formatHundredths,
  parseToHundredths,
  checkDecimalRoundTenthTask,
  roundHundredthsToTenth,
  checkFractionAddSubLikeTask,
  fractionAddSubResultNum,
  type FractionOp,
  checkMult2x2Task,
  checkDivision2DigitTask,
  checkFractionPercentEquivTask,
  checkParallelogramAreaTask,
  parallelogramArea,
  checkTriangleAreaTask,
  checkSignedIntegerCompareTask,
  signedRelation,
  type SignedRelation,
  checkDecimalThousandthCompareTask,
  thousandthsRelation,
  formatThousandths,
  parseToThousandths,
  checkDecimalRoundHundredthTask,
  roundThousandthsToHundredth,
  checkFractionAddSubUnlikeTask,
  fractionAddSubUnlikeResult,
  checkPercentOfTask,
  percentOfResult,
  checkPerfectSquareRootTask,
  checkIsPerfectSquareTask,
  exactSqrt,
  isPerfectSquare,
  checkIntegerAddSubTask,
  integerAddSubResult,
  type IntegerAddSubOp,
  checkPowerEvalTask,
  powerValue,
  checkGcfPairTask,
  checkLcmPairTask,
  gcd,
  lcm,
  checkFractionMulDivTask,
  fractionMulDivResult,
  type FractionMulDivOp,
  checkDecimalMulDivTask,
  decimalMulDivTenThousandths,
  formatTenThousandths,
  parseToTenThousandths,
  type DecimalMulDivOp,
  checkProportionSolveTask,
  proportionSolve,
  checkIntegerMulDivTask,
  integerMulDivResult,
  type IntegerMulDivOp,
  checkPowerOfTenScaleTask,
  powerOfTenScaleThousandths,
  type PowerOfTenOp,
  checkSqrtBetweenTask,
  floorSqrt,
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
export const ADD_10000 = 'SK-NS-add-within10000';
export const SUB_10000 = 'SK-NS-sub-within10000';
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
export const DEC_COMPARE = 'SK-NS-decimal-compare';
export const DEC_ROUND = 'SK-NS-decimal-round';
export const FRAC_DEC_EQUIV = 'SK-NS-fraction-decimal-equiv';
export const RECT_AREA = 'SK-ME-rect-area';
export const RECT_SIDE = 'SK-ME-rect-missing-side';
export const DEC_H_COMPARE = 'SK-NS-decimal-hundredth-compare';
export const DEC_ROUND_TENTH = 'SK-NS-decimal-round-tenth';
export const FRAC_ADDSUB_LIKE = 'SK-NS-fraction-addsub-like';
export const MULT_2X2 = 'SK-NS-mult-2x2';
export const DIV_2DIGIT = 'SK-NS-div-2digit';
export const FRAC_PCT_EQUIV = 'SK-NS-fraction-percent-equiv';
export const PARALLELOGRAM_AREA = 'SK-ME-parallelogram-area';
export const TRIANGLE_AREA = 'SK-ME-triangle-area';
export const INT_SIGNED_COMPARE = 'SK-NS-integer-signed-compare';
export const DEC_T_COMPARE = 'SK-NS-decimal-thousandth-compare';
export const DEC_ROUND_HUNDREDTH = 'SK-NS-decimal-round-hundredth';
export const FRAC_ADDSUB_UNLIKE = 'SK-NS-fraction-addsub-unlike';
export const PERCENT_OF = 'SK-NS-percent-of';
export const PERFECT_SQUARE_ROOT = 'SK-NS-perfect-square-root';
export const IS_PERFECT_SQUARE = 'SK-NS-is-perfect-square';
export const INT_ADDSUB_SIGNED = 'SK-NS-integer-addsub-signed';
export const POWER_EVAL = 'SK-NS-power-eval';
export const GCF_PAIR = 'SK-NS-gcf-pair';
export const LCM_PAIR = 'SK-NS-lcm-pair';
export const FRAC_MULDIV = 'SK-NS-fraction-muldiv';
export const DEC_MULDIV = 'SK-NS-decimal-muldiv';
export const PROPORTION_SOLVE = 'SK-NS-proportion-solve';
export const INT_MULDIV_SIGNED = 'SK-NS-integer-muldiv-signed';
export const POWER_OF_TEN_SCALE = 'SK-NS-power-of-ten-scale';
export const SQRT_BETWEEN = 'SK-NS-sqrt-between';
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
  readonly course: 'addition' | 'add-subtract-g4';
  readonly skillId: typeof ADD_10 | typeof ADD_20 | typeof ADD_10000;
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
  readonly course: 'subtraction' | 'subtraction-g2' | 'add-subtract-g4';
  readonly skillId: typeof SUB_10 | typeof SUB_20 | typeof SUB_100 | typeof SUB_10000;
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
interface DecimalCompareTaskT {
  readonly subject: 'math';
  readonly course: 'decimals-g4';
  readonly skillId: typeof DEC_COMPARE;
  readonly kind: 'decimal_tenth_compare';
  readonly leftTenths: number;
  readonly rightTenths: number;
}
interface DecimalRoundTaskT {
  readonly subject: 'math';
  readonly course: 'decimals-g4';
  readonly skillId: typeof DEC_ROUND;
  readonly kind: 'decimal_round_whole';
  readonly tenths: number;
}
interface FractionDecimalEquivTaskT {
  readonly subject: 'math';
  readonly course: 'decimals-g4';
  readonly skillId: typeof FRAC_DEC_EQUIV;
  readonly kind: 'fraction_decimal_equiv';
  readonly numerator: number;
  readonly denominator: number;
  readonly tenths: number;
}
interface RectangleAreaTaskT {
  readonly subject: 'math';
  readonly course: 'area-g4';
  readonly skillId: typeof RECT_AREA;
  readonly kind: 'rectangle_area';
  readonly length: number;
  readonly width: number;
}
interface RectangleMissingSideTaskT {
  readonly subject: 'math';
  readonly course: 'area-g4';
  readonly skillId: typeof RECT_SIDE;
  readonly kind: 'rectangle_missing_side';
  readonly area: number;
  readonly knownSide: number;
}
interface DecimalHundredthCompareTaskT {
  readonly subject: 'math';
  readonly course: 'decimals-g5';
  readonly skillId: typeof DEC_H_COMPARE;
  readonly kind: 'decimal_hundredth_compare';
  readonly leftHundredths: number;
  readonly rightHundredths: number;
}
interface DecimalRoundTenthTaskT {
  readonly subject: 'math';
  readonly course: 'decimals-g5';
  readonly skillId: typeof DEC_ROUND_TENTH;
  readonly kind: 'decimal_round_tenth';
  readonly hundredths: number;
}
interface FractionAddSubLikeTaskT {
  readonly subject: 'math';
  readonly course: 'fractions-g5';
  readonly skillId: typeof FRAC_ADDSUB_LIKE;
  readonly kind: 'fraction_addsub_like';
  readonly leftNum: number;
  readonly rightNum: number;
  readonly denom: number;
  readonly op: FractionOp;
}
interface Mult2x2TaskT {
  readonly subject: 'math';
  readonly course: 'multiplication-g5';
  readonly skillId: typeof MULT_2X2;
  readonly kind: 'mult_2x2';
  readonly factorA: number;
  readonly factorB: number;
}
interface Division2DigitTaskT {
  readonly subject: 'math';
  readonly course: 'division-g5';
  readonly skillId: typeof DIV_2DIGIT;
  readonly kind: 'division_2digit';
  readonly dividend: number;
  readonly divisor: number;
}
interface FractionPercentEquivTaskT {
  readonly subject: 'math';
  readonly course: 'percents-g5';
  readonly skillId: typeof FRAC_PCT_EQUIV;
  readonly kind: 'fraction_percent_equiv';
  readonly numerator: number;
  readonly denominator: number;
  readonly percent: number;
}
interface ParallelogramAreaTaskT {
  readonly subject: 'math';
  readonly course: 'area-g5';
  readonly skillId: typeof PARALLELOGRAM_AREA;
  readonly kind: 'parallelogram_area';
  readonly base: number;
  readonly height: number;
}
interface TriangleAreaTaskT {
  readonly subject: 'math';
  readonly course: 'area-g5';
  readonly skillId: typeof TRIANGLE_AREA;
  readonly kind: 'triangle_area';
  readonly base: number;
  readonly height: number;
}
interface SignedIntegerCompareTaskT {
  readonly subject: 'math';
  readonly course: 'integers-g6';
  readonly skillId: typeof INT_SIGNED_COMPARE;
  readonly kind: 'integer_signed_compare';
  readonly left: number;
  readonly right: number;
}
interface DecimalThousandthCompareTaskT {
  readonly subject: 'math';
  readonly course: 'decimals-g6';
  readonly skillId: typeof DEC_T_COMPARE;
  readonly kind: 'decimal_thousandth_compare';
  readonly leftThousandths: number;
  readonly rightThousandths: number;
}
interface DecimalRoundHundredthTaskT {
  readonly subject: 'math';
  readonly course: 'decimals-g6';
  readonly skillId: typeof DEC_ROUND_HUNDREDTH;
  readonly kind: 'decimal_round_hundredth';
  readonly thousandths: number;
}
interface FractionAddSubUnlikeTaskT {
  readonly subject: 'math';
  readonly course: 'fractions-g6';
  readonly skillId: typeof FRAC_ADDSUB_UNLIKE;
  readonly kind: 'fraction_addsub_unlike';
  readonly leftNum: number;
  readonly leftDenom: number;
  readonly rightNum: number;
  readonly rightDenom: number;
  readonly op: FractionOp;
}
interface PercentOfTaskT {
  readonly subject: 'math';
  readonly course: 'percents-g6';
  readonly skillId: typeof PERCENT_OF;
  readonly kind: 'percent_of';
  readonly percent: number;
  readonly whole: number;
}
interface PerfectSquareRootTaskT {
  readonly subject: 'math';
  readonly course: 'squares-g7';
  readonly skillId: typeof PERFECT_SQUARE_ROOT;
  readonly kind: 'perfect_square_root';
  readonly square: number;
}
interface IsPerfectSquareTaskT {
  readonly subject: 'math';
  readonly course: 'squares-g7';
  readonly skillId: typeof IS_PERFECT_SQUARE;
  readonly kind: 'is_perfect_square';
  readonly value: number;
}
interface IntegerAddSubTaskT {
  readonly subject: 'math';
  readonly course: 'integers-arith-g7';
  readonly skillId: typeof INT_ADDSUB_SIGNED;
  readonly kind: 'integer_addsub_signed';
  readonly left: number;
  readonly right: number;
  readonly op: IntegerAddSubOp;
}
interface PowerEvalTaskT {
  readonly subject: 'math';
  readonly course: 'exponents-g7';
  readonly skillId: typeof POWER_EVAL;
  readonly kind: 'power_eval';
  readonly base: number;
  readonly exponent: number;
}
interface GcfPairTaskT {
  readonly subject: 'math';
  readonly course: 'factors-g7';
  readonly skillId: typeof GCF_PAIR;
  readonly kind: 'gcf_pair';
  readonly a: number;
  readonly b: number;
}
interface LcmPairTaskT {
  readonly subject: 'math';
  readonly course: 'factors-g7';
  readonly skillId: typeof LCM_PAIR;
  readonly kind: 'lcm_pair';
  readonly a: number;
  readonly b: number;
}
interface FractionMulDivTaskT {
  readonly subject: 'math';
  readonly course: 'fractions-muldiv-g7';
  readonly skillId: typeof FRAC_MULDIV;
  readonly kind: 'fraction_muldiv';
  readonly leftNum: number;
  readonly leftDenom: number;
  readonly rightNum: number;
  readonly rightDenom: number;
  readonly op: FractionMulDivOp;
}
interface DecimalMulDivTaskT {
  readonly subject: 'math';
  readonly course: 'decimals-muldiv-g7';
  readonly skillId: typeof DEC_MULDIV;
  readonly kind: 'decimal_muldiv';
  readonly leftHundredths: number;
  readonly rightHundredths: number;
  readonly op: DecimalMulDivOp;
}
interface ProportionSolveTaskT {
  readonly subject: 'math';
  readonly course: 'proportions-g7';
  readonly skillId: typeof PROPORTION_SOLVE;
  readonly kind: 'proportion_solve';
  readonly a: number;
  readonly b: number;
  readonly c: number;
}
interface IntegerMulDivTaskT {
  readonly subject: 'math';
  readonly course: 'integers-muldiv-g8';
  readonly skillId: typeof INT_MULDIV_SIGNED;
  readonly kind: 'integer_muldiv_signed';
  readonly left: number;
  readonly right: number;
  readonly op: IntegerMulDivOp;
}
interface PowerOfTenScaleTaskT {
  readonly subject: 'math';
  readonly course: 'powers-of-ten-g8';
  readonly skillId: typeof POWER_OF_TEN_SCALE;
  readonly kind: 'power_of_ten_scale';
  readonly valueThousandths: number;
  readonly exponent: number;
  readonly op: PowerOfTenOp;
}
interface SqrtBetweenTaskT {
  readonly subject: 'math';
  readonly course: 'sqrt-estimate-g8';
  readonly skillId: typeof SQRT_BETWEEN;
  readonly kind: 'sqrt_between';
  readonly value: number;
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
  | DecimalCompareTaskT
  | DecimalRoundTaskT
  | FractionDecimalEquivTaskT
  | RectangleAreaTaskT
  | RectangleMissingSideTaskT
  | DecimalHundredthCompareTaskT
  | DecimalRoundTenthTaskT
  | FractionAddSubLikeTaskT
  | Mult2x2TaskT
  | Division2DigitTaskT
  | FractionPercentEquivTaskT
  | ParallelogramAreaTaskT
  | TriangleAreaTaskT
  | SignedIntegerCompareTaskT
  | DecimalThousandthCompareTaskT
  | DecimalRoundHundredthTaskT
  | FractionAddSubUnlikeTaskT
  | PercentOfTaskT
  | PerfectSquareRootTaskT
  | IsPerfectSquareTaskT
  | IntegerAddSubTaskT
  | PowerEvalTaskT
  | GcfPairTaskT
  | LcmPairTaskT
  | FractionMulDivTaskT
  | DecimalMulDivTaskT
  | ProportionSolveTaskT
  | IntegerMulDivTaskT
  | PowerOfTenScaleTaskT
  | SqrtBetweenTaskT
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
const add4 = (a: number, b: number): AdditionTask => ({
  subject: 'math',
  course: 'add-subtract-g4',
  skillId: ADD_10000,
  kind: 'integer_addition',
  a,
  b,
});
const sub4 = (a: number, b: number): SubtractionTask => ({
  subject: 'math',
  course: 'add-subtract-g4',
  skillId: SUB_10000,
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
const decCompare = (leftTenths: number, rightTenths: number): DecimalCompareTaskT => ({
  subject: 'math',
  course: 'decimals-g4',
  skillId: DEC_COMPARE,
  kind: 'decimal_tenth_compare',
  leftTenths,
  rightTenths,
});
const decRound = (tenths: number): DecimalRoundTaskT => ({
  subject: 'math',
  course: 'decimals-g4',
  skillId: DEC_ROUND,
  kind: 'decimal_round_whole',
  tenths,
});
const fracDecEquiv = (
  numerator: number,
  denominator: number,
  tenths: number,
): FractionDecimalEquivTaskT => ({
  subject: 'math',
  course: 'decimals-g4',
  skillId: FRAC_DEC_EQUIV,
  kind: 'fraction_decimal_equiv',
  numerator,
  denominator,
  tenths,
});
const rectArea = (length: number, width: number): RectangleAreaTaskT => ({
  subject: 'math',
  course: 'area-g4',
  skillId: RECT_AREA,
  kind: 'rectangle_area',
  length,
  width,
});
const rectSide = (area: number, knownSide: number): RectangleMissingSideTaskT => ({
  subject: 'math',
  course: 'area-g4',
  skillId: RECT_SIDE,
  kind: 'rectangle_missing_side',
  area,
  knownSide,
});
const decHCompare = (
  leftHundredths: number,
  rightHundredths: number,
): DecimalHundredthCompareTaskT => ({
  subject: 'math',
  course: 'decimals-g5',
  skillId: DEC_H_COMPARE,
  kind: 'decimal_hundredth_compare',
  leftHundredths,
  rightHundredths,
});
const decRoundTenth = (hundredths: number): DecimalRoundTenthTaskT => ({
  subject: 'math',
  course: 'decimals-g5',
  skillId: DEC_ROUND_TENTH,
  kind: 'decimal_round_tenth',
  hundredths,
});
const fracAddSub = (
  leftNum: number,
  rightNum: number,
  denom: number,
  op: FractionOp,
): FractionAddSubLikeTaskT => ({
  subject: 'math',
  course: 'fractions-g5',
  skillId: FRAC_ADDSUB_LIKE,
  kind: 'fraction_addsub_like',
  leftNum,
  rightNum,
  denom,
  op,
});
const mult2x2 = (factorA: number, factorB: number): Mult2x2TaskT => ({
  subject: 'math',
  course: 'multiplication-g5',
  skillId: MULT_2X2,
  kind: 'mult_2x2',
  factorA,
  factorB,
});
const div2digit = (dividend: number, divisor: number): Division2DigitTaskT => ({
  subject: 'math',
  course: 'division-g5',
  skillId: DIV_2DIGIT,
  kind: 'division_2digit',
  dividend,
  divisor,
});
const fracPercent = (
  numerator: number,
  denominator: number,
  percent: number,
): FractionPercentEquivTaskT => ({
  subject: 'math',
  course: 'percents-g5',
  skillId: FRAC_PCT_EQUIV,
  kind: 'fraction_percent_equiv',
  numerator,
  denominator,
  percent,
});
const pgramArea = (base: number, height: number): ParallelogramAreaTaskT => ({
  subject: 'math',
  course: 'area-g5',
  skillId: PARALLELOGRAM_AREA,
  kind: 'parallelogram_area',
  base,
  height,
});
const triArea = (base: number, height: number): TriangleAreaTaskT => ({
  subject: 'math',
  course: 'area-g5',
  skillId: TRIANGLE_AREA,
  kind: 'triangle_area',
  base,
  height,
});
const intCompare = (left: number, right: number): SignedIntegerCompareTaskT => ({
  subject: 'math',
  course: 'integers-g6',
  skillId: INT_SIGNED_COMPARE,
  kind: 'integer_signed_compare',
  left,
  right,
});
const decTCompare = (
  leftThousandths: number,
  rightThousandths: number,
): DecimalThousandthCompareTaskT => ({
  subject: 'math',
  course: 'decimals-g6',
  skillId: DEC_T_COMPARE,
  kind: 'decimal_thousandth_compare',
  leftThousandths,
  rightThousandths,
});
const decRoundHundredth = (thousandths: number): DecimalRoundHundredthTaskT => ({
  subject: 'math',
  course: 'decimals-g6',
  skillId: DEC_ROUND_HUNDREDTH,
  kind: 'decimal_round_hundredth',
  thousandths,
});
const fracAddSubUnlike = (
  leftNum: number,
  leftDenom: number,
  rightNum: number,
  rightDenom: number,
  op: FractionOp,
): FractionAddSubUnlikeTaskT => ({
  subject: 'math',
  course: 'fractions-g6',
  skillId: FRAC_ADDSUB_UNLIKE,
  kind: 'fraction_addsub_unlike',
  leftNum,
  leftDenom,
  rightNum,
  rightDenom,
  op,
});
const percentOf = (percent: number, whole: number): PercentOfTaskT => ({
  subject: 'math',
  course: 'percents-g6',
  skillId: PERCENT_OF,
  kind: 'percent_of',
  percent,
  whole,
});
const squareRoot = (square: number): PerfectSquareRootTaskT => ({
  subject: 'math',
  course: 'squares-g7',
  skillId: PERFECT_SQUARE_ROOT,
  kind: 'perfect_square_root',
  square,
});
const isSquare = (value: number): IsPerfectSquareTaskT => ({
  subject: 'math',
  course: 'squares-g7',
  skillId: IS_PERFECT_SQUARE,
  kind: 'is_perfect_square',
  value,
});
const intAddSub = (left: number, right: number, op: IntegerAddSubOp): IntegerAddSubTaskT => ({
  subject: 'math',
  course: 'integers-arith-g7',
  skillId: INT_ADDSUB_SIGNED,
  kind: 'integer_addsub_signed',
  left,
  right,
  op,
});
const power = (base: number, exponent: number): PowerEvalTaskT => ({
  subject: 'math',
  course: 'exponents-g7',
  skillId: POWER_EVAL,
  kind: 'power_eval',
  base,
  exponent,
});
const gcfPair = (a: number, b: number): GcfPairTaskT => ({
  subject: 'math',
  course: 'factors-g7',
  skillId: GCF_PAIR,
  kind: 'gcf_pair',
  a,
  b,
});
const lcmPair = (a: number, b: number): LcmPairTaskT => ({
  subject: 'math',
  course: 'factors-g7',
  skillId: LCM_PAIR,
  kind: 'lcm_pair',
  a,
  b,
});
const fracMulDiv = (
  leftNum: number,
  leftDenom: number,
  rightNum: number,
  rightDenom: number,
  op: FractionMulDivOp,
): FractionMulDivTaskT => ({
  subject: 'math',
  course: 'fractions-muldiv-g7',
  skillId: FRAC_MULDIV,
  kind: 'fraction_muldiv',
  leftNum,
  leftDenom,
  rightNum,
  rightDenom,
  op,
});
const decMulDiv = (
  leftHundredths: number,
  rightHundredths: number,
  op: DecimalMulDivOp,
): DecimalMulDivTaskT => ({
  subject: 'math',
  course: 'decimals-muldiv-g7',
  skillId: DEC_MULDIV,
  kind: 'decimal_muldiv',
  leftHundredths,
  rightHundredths,
  op,
});
const proportion = (a: number, b: number, c: number): ProportionSolveTaskT => ({
  subject: 'math',
  course: 'proportions-g7',
  skillId: PROPORTION_SOLVE,
  kind: 'proportion_solve',
  a,
  b,
  c,
});
const intMulDiv = (left: number, right: number, op: IntegerMulDivOp): IntegerMulDivTaskT => ({
  subject: 'math',
  course: 'integers-muldiv-g8',
  skillId: INT_MULDIV_SIGNED,
  kind: 'integer_muldiv_signed',
  left,
  right,
  op,
});
const powerOfTen = (
  valueThousandths: number,
  exponent: number,
  op: PowerOfTenOp,
): PowerOfTenScaleTaskT => ({
  subject: 'math',
  course: 'powers-of-ten-g8',
  skillId: POWER_OF_TEN_SCALE,
  kind: 'power_of_ten_scale',
  valueThousandths,
  exponent,
  op,
});
const sqrtBetween = (value: number): SqrtBetweenTaskT => ({
  subject: 'math',
  course: 'sqrt-estimate-g8',
  skillId: SQRT_BETWEEN,
  kind: 'sqrt_between',
  value,
});
/** Parse a signed-integer answer string like "-7", "+3", or "12"; null if malformed. */
const parseSignedInt = (a: string): number | null => {
  const m = a.trim().match(/^[+-]?\d+$/);
  return m ? Number(m[0]) : null;
};
/** Parse a fraction answer string "n/d" (or a whole "n" = n/1); null if malformed. */
const parseFraction = (a: string): { num: number; denom: number } | null => {
  const frac = a.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const denom = Number(frac[2]);
    return denom > 0 ? { num: Number(frac[1]), denom } : null;
  }
  const whole = a.trim().match(/^(\d+)$/);
  return whole ? { num: Number(whole[1]), denom: 1 } : null;
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
  // Grade 4 — add and subtract to 10 000 (same oracles, higher bound).
  'add4-1': add4(3400, 2500), // 5900
  'add4-2': add4(4675, 3218), // 7893 (multi-place carrying)
  'add4-3': add4(6090, 905), // 6995
  'add4-4': add4(1234, 8766), // 10000 (to the ceiling)
  'sub4-1': sub4(5900, 2500), // 3400
  'sub4-2': sub4(8002, 3457), // 4545 (regroup across zeros)
  'sub4-3': sub4(7000, 1234), // 5766
  'sub4-4': sub4(9999, 4567), // 5432
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
  // decimal tenths — compare
  'dcmp-1': decCompare(23, 27), // 2.3 < 2.7 → lt
  'dcmp-2': decCompare(8, 10), // 0.8 < 1.0 → lt (point trap: 8 vs 1)
  'dcmp-3': decCompare(50, 50), // 5.0 == 5.0 → eq
  'dcmp-4': decCompare(41, 39), // 4.1 > 3.9 → gt
  // decimal tenths — round to the nearest whole
  'drnd-1': decRound(24), // 2.4 → 2
  'drnd-2': decRound(27), // 2.7 → 3
  'drnd-3': decRound(25), // 2.5 → 3 (half rounds up)
  'drnd-4': decRound(60), // 6.0 → 6
  // fraction ↔ decimal tenth equivalence
  'fde-1': fracDecEquiv(3, 10, 3), // 3/10 == 0.3 → yes
  'fde-2': fracDecEquiv(1, 2, 5), // 1/2 == 0.5 → yes
  'fde-3': fracDecEquiv(1, 4, 3), // 1/4 == 0.3? → no
  'fde-4': fracDecEquiv(7, 10, 7), // 7/10 == 0.7 → yes
  // rectangle area and missing side
  'rarea-1': rectArea(6, 4), // 24
  'rarea-2': rectArea(9, 7), // 63
  'rarea-3': rectArea(12, 5), // 60
  'rarea-4': rectArea(8, 8), // 64 (adds-sides trap → 16)
  'rside-1': rectSide(24, 6), // 4
  'rside-2': rectSide(63, 9), // 7
  'rside-3': rectSide(48, 6), // 8
  'rside-4': rectSide(100, 4), // 25
  // decimal hundredths — compare
  'dhc-1': decHCompare(247, 250), // 2.47 < 2.50 → lt (longer-looks-bigger trap)
  'dhc-2': decHCompare(80, 8), // 0.80 > 0.08 → gt
  'dhc-3': decHCompare(305, 305), // 3.05 == 3.05 → eq
  'dhc-4': decHCompare(150, 105), // 1.50 > 1.05 → gt
  // decimal — round to the nearest tenth
  'drt-1': decRoundTenth(247), // 2.47 → 2.5
  'drt-2': decRoundTenth(243), // 2.43 → 2.4
  'drt-3': decRoundTenth(295), // 2.95 → 3.0 (carries to the whole)
  'drt-4': decRoundTenth(60), // 0.60 → 0.6
  // add/subtract fractions with like denominators
  'fas-1': fracAddSub(1, 2, 5, '+'), // 1/5 + 2/5 = 3/5
  'fas-2': fracAddSub(5, 2, 6, '-'), // 5/6 - 2/6 = 3/6 (= 1/2)
  'fas-3': fracAddSub(3, 3, 8, '+'), // 3/8 + 3/8 = 6/8
  'fas-4': fracAddSub(7, 4, 10, '-'), // 7/10 - 4/10 = 3/10
  // 2-digit × 2-digit multiplication
  'm2-1': mult2x2(23, 45), // 1035
  'm2-2': mult2x2(34, 12), // 408
  'm2-3': mult2x2(50, 60), // 3000
  'm2-4': mult2x2(27, 19), // 513 (ones-digit-only trap → 171)
  // 3-digit ÷ 2-digit division with remainder
  'd2-1': div2digit(247, 12), // 20 r 7
  'd2-2': div2digit(500, 25), // 20 r 0
  'd2-3': div2digit(963, 40), // 24 r 3
  'd2-4': div2digit(184, 15), // 12 r 4 (drops-remainder trap → "12 0")
  // fraction ↔ percent equivalence
  'fpc-1': fracPercent(1, 2, 50), // 1/2 == 50% → yes
  'fpc-2': fracPercent(3, 4, 75), // 3/4 == 75% → yes
  'fpc-3': fracPercent(1, 4, 40), // 1/4 == 40%? → no
  'fpc-4': fracPercent(1, 5, 20), // 1/5 == 20% → yes
  // parallelogram & triangle area
  'pga-1': pgramArea(6, 4), // 24
  'pga-2': pgramArea(9, 7), // 63
  'pga-3': pgramArea(12, 5), // 60
  'pga-4': pgramArea(8, 8), // 64 (adds-sides trap → 16)
  'tri-1': triArea(6, 4), // 12
  'tri-2': triArea(10, 5), // 25
  'tri-3': triArea(8, 7), // 28
  'tri-4': triArea(12, 9), // 54 (forgot-to-halve trap → 108)
  // signed integer comparison
  'int-1': intCompare(-5, -2), // -5 < -2 → lt (magnitude trap: 5 > 2)
  'int-2': intCompare(3, -8), // 3 > -8 → gt
  'int-3': intCompare(-7, -7), // eq
  'int-4': intCompare(0, -4), // 0 > -4 → gt
  // decimal thousandths — compare
  'dtc-1': decTCompare(2475, 2500), // 2.475 < 2.500 → lt (longer-looks-bigger trap)
  'dtc-2': decTCompare(800, 80), // 0.800 > 0.080 → gt
  'dtc-3': decTCompare(3050, 3050), // 3.050 == 3.050 → eq
  'dtc-4': decTCompare(1500, 1050), // 1.500 > 1.050 → gt
  // decimal — round to the nearest hundredth
  'drh-1': decRoundHundredth(2475), // 2.475 → 2.48
  'drh-2': decRoundHundredth(2473), // 2.473 → 2.47
  'drh-3': decRoundHundredth(2995), // 2.995 → 3.00 (carries)
  'drh-4': decRoundHundredth(600), // 0.600 → 0.60
  // fractions — add/subtract with UNLIKE denominators (value-graded)
  'fau-1': fracAddSubUnlike(1, 2, 1, 3, '+'), // 1/2 + 1/3 = 5/6
  'fau-2': fracAddSubUnlike(3, 4, 1, 2, '-'), // 3/4 - 1/2 = 1/4 (= 2/8)
  'fau-3': fracAddSubUnlike(2, 3, 1, 6, '+'), // 2/3 + 1/6 = 5/6 (= 10/12)
  'fau-4': fracAddSubUnlike(5, 6, 1, 3, '-'), // 5/6 - 1/3 = 1/2 (= 3/6)
  // percent of a whole number (whole-number result only)
  'pof-1': percentOf(25, 80), // 25% of 80 = 20
  'pof-2': percentOf(10, 350), // 10% of 350 = 35
  'pof-3': percentOf(50, 46), // 50% of 46 = 23
  'pof-4': percentOf(100, 7), // 100% of 7 = 7
  // perfect squares — determine the root of a perfect square
  'psr-1': squareRoot(144), // √144 = 12
  'psr-2': squareRoot(49), // √49 = 7
  'psr-3': squareRoot(100), // √100 = 10
  'psr-4': squareRoot(225), // √225 = 15
  // perfect squares — is n a perfect square? (yes/no)
  'ips-1': isSquare(64), // yes (8²)
  'ips-2': isSquare(50), // no
  'ips-3': isSquare(121), // yes (11²)
  'ips-4': isSquare(90), // no
  // signed integer add/subtract (results may be negative)
  'ias-1': intAddSub(-5, 3, '+'), // -5 + 3 = -2
  'ias-2': intAddSub(-5, -3, '-'), // -5 - (-3) = -2
  'ias-3': intAddSub(4, 9, '-'), // 4 - 9 = -5
  'ias-4': intAddSub(-8, -6, '+'), // -8 + (-6) = -14
  // exponents — repeated multiplication of whole numbers
  'pow-1': power(2, 5), // 2^5 = 32
  'pow-2': power(10, 3), // 10^3 = 1000
  'pow-3': power(7, 2), // 7^2 = 49
  'pow-4': power(3, 4), // 3^4 = 81
  // greatest common factor of two whole numbers (≤144)
  'gcf-1': gcfPair(12, 18), // GCF = 6
  'gcf-2': gcfPair(144, 60), // GCF = 12
  'gcf-3': gcfPair(7, 13), // GCF = 1 (coprime)
  'gcf-4': gcfPair(24, 36), // GCF = 12
  // lowest common multiple of two whole numbers
  'lcm-1': lcmPair(4, 6), // LCM = 12
  'lcm-2': lcmPair(8, 12), // LCM = 24
  'lcm-3': lcmPair(5, 9), // LCM = 45
  'lcm-4': lcmPair(6, 10), // LCM = 30
  // fraction multiply / divide (value-graded)
  'fmd-1': fracMulDiv(2, 3, 3, 4, '×'), // 2/3 × 3/4 = 6/12 = 1/2
  'fmd-2': fracMulDiv(1, 2, 3, 4, '÷'), // 1/2 ÷ 3/4 = 4/6 = 2/3
  'fmd-3': fracMulDiv(3, 5, 5, 6, '×'), // 3/5 × 5/6 = 15/30 = 1/2
  'fmd-4': fracMulDiv(3, 4, 1, 2, '÷'), // 3/4 ÷ 1/2 = 6/4 = 3/2
  // decimal multiply / divide (float-free; operands are hundredths)
  'dmd-1': decMulDiv(50, 40, '×'), // 0.5 × 0.4 = 0.2
  'dmd-2': decMulDiv(60, 20, '÷'), // 0.6 ÷ 0.2 = 3
  'dmd-3': decMulDiv(120, 30, '×'), // 1.2 × 0.3 = 0.36
  'dmd-4': decMulDiv(250, 50, '÷'), // 2.5 ÷ 0.5 = 5
  // proportional reasoning — solve a/b = c/x for x
  'prop-1': proportion(2, 3, 4), // 2/3 = 4/x → x = 6
  'prop-2': proportion(3, 4, 9), // 3/4 = 9/x → x = 12
  'prop-3': proportion(5, 2, 10), // 5/2 = 10/x → x = 4
  'prop-4': proportion(4, 5, 8), // 4/5 = 8/x → x = 10
  // signed integer multiply / divide (sign rules; divide is exact only)
  'imd-1': intMulDiv(-6, 7, '×'), // -6 × 7 = -42
  'imd-2': intMulDiv(-6, -7, '×'), // -6 × -7 = 42
  'imd-3': intMulDiv(-48, 6, '÷'), // -48 ÷ 6 = -8
  'imd-4': intMulDiv(-48, -6, '÷'), // -48 ÷ -6 = 8
  // multiply / divide by a power of ten (float-free; value is thousandths)
  'pt-1': powerOfTen(3500, 2, '×'), // 3.5 × 100 = 350
  'pt-2': powerOfTen(42, 3, '×'), // 0.042 × 1000 = 42
  'pt-3': powerOfTen(350000, 2, '÷'), // 350 ÷ 100 = 3.5
  'pt-4': powerOfTen(60000, 3, '÷'), // 60 ÷ 1000 = 0.06
  // estimate a square root between two consecutive whole numbers (non-perfect-square)
  'sqb-1': sqrtBetween(50), // √50 between 7 and 8
  'sqb-2': sqrtBetween(30), // √30 between 5 and 6
  'sqb-3': sqrtBetween(99), // √99 between 9 and 10
  'sqb-4': sqrtBetween(72), // √72 between 8 and 9
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
  'add4-xfer': add4(2718, 4056), // 6774 (novel)
  'sub4-xfer': sub4(6230, 1485), // 4745 (novel, regroup)
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
  'dcmp-xfer': decCompare(62, 71), // 6.2 < 7.1 → lt (novel)
  'drnd-xfer': decRound(48), // 4.8 → 5 (novel)
  'fde-xfer': fracDecEquiv(4, 5, 8), // 4/5 == 0.8 → yes (novel)
  'rarea-xfer': rectArea(7, 9), // 63 (novel)
  'rside-xfer': rectSide(72, 8), // 9 (novel)
  'dhc-xfer': decHCompare(409, 490), // 4.09 < 4.90 → lt (novel)
  'drt-xfer': decRoundTenth(168), // 1.68 → 1.7 (novel)
  'fas-xfer': fracAddSub(4, 5, 12, '+'), // 4/12 + 5/12 = 9/12 (novel)
  'm2-xfer': mult2x2(38, 26), // 988 (novel)
  'd2-xfer': div2digit(375, 18), // 20 r 15 (novel)
  'fpc-xfer': fracPercent(3, 5, 60), // 3/5 == 60% → yes (novel)
  'pga-xfer': pgramArea(7, 9), // 63 (novel)
  'tri-xfer': triArea(14, 6), // 42 (novel)
  'int-xfer': intCompare(-9, -11), // -9 > -11 → gt (novel)
  'dtc-xfer': decTCompare(4090, 4900), // 4.090 < 4.900 → lt (novel)
  'drh-xfer': decRoundHundredth(1678), // 1.678 → 1.68 (novel)
  'fau-xfer': fracAddSubUnlike(3, 8, 1, 4, '+'), // 3/8 + 1/4 = 5/8 (novel; = 20/32)
  'pof-xfer': percentOf(20, 65), // 20% of 65 = 13 (novel)
  'psr-xfer': squareRoot(169), // √169 = 13 (novel)
  'ips-xfer': isSquare(196), // yes (14²) (novel)
  'ias-xfer': intAddSub(7, -10, '+'), // 7 + (-10) = -3 (novel)
  'pow-xfer': power(5, 3), // 5^3 = 125 (novel)
  'gcf-xfer': gcfPair(48, 72), // GCF = 24 (novel)
  'lcm-xfer': lcmPair(9, 12), // LCM = 36 (novel)
  'fmd-xfer': fracMulDiv(2, 5, 3, 4, '×'), // 2/5 × 3/4 = 6/20 = 3/10 (novel)
  'dmd-xfer': decMulDiv(80, 150, '×'), // 0.8 × 1.5 = 1.2 (novel)
  'prop-xfer': proportion(3, 7, 6), // 3/7 = 6/x → x = 14 (novel)
  'imd-xfer': intMulDiv(9, -8, '×'), // 9 × -8 = -72 (novel)
  'pt-xfer': powerOfTen(1250, 2, '×'), // 1.25 × 100 = 125 (novel)
  'sqb-xfer': sqrtBetween(40), // √40 between 6 and 7 (novel)
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
  'add4-xfer',
  'sub4-xfer',
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
  'dcmp-xfer',
  'drnd-xfer',
  'fde-xfer',
  'rarea-xfer',
  'rside-xfer',
  'dhc-xfer',
  'drt-xfer',
  'fas-xfer',
  'm2-xfer',
  'd2-xfer',
  'fpc-xfer',
  'pga-xfer',
  'tri-xfer',
  'int-xfer',
  'dtc-xfer',
  'drh-xfer',
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
  if (task.kind === 'decimal_tenth_compare') {
    return {
      question: `Compare ${formatTenths(task.leftTenths)} and ${formatTenths(
        task.rightTenths,
      )} — is the first less than (lt), equal to (eq), or greater than (gt) the second?`,
      options: ['lt', 'eq', 'gt'],
    };
  }
  if (task.kind === 'decimal_round_whole') {
    return {
      question: `Round ${formatTenths(task.tenths)} to the nearest whole number.`,
      options: [] /* type the number */,
    };
  }
  if (task.kind === 'fraction_decimal_equiv') {
    return {
      question: `Is ${task.numerator}/${task.denominator} equal in value to ${formatTenths(
        task.tenths,
      )}? (yes / no)`,
      options: ['yes', 'no'],
    };
  }
  if (task.kind === 'rectangle_area') {
    return {
      question: `A rectangle is ${task.length} by ${task.width}. What is its area (square units)?`,
      options: [] /* type the number */,
    };
  }
  if (task.kind === 'rectangle_missing_side') {
    return {
      question: `A rectangle has an area of ${task.area} square units and one side of ${task.knownSide}. How long is the other side?`,
      options: [] /* type the number */,
    };
  }
  if (task.kind === 'decimal_hundredth_compare') {
    return {
      question: `Compare ${formatHundredths(task.leftHundredths)} and ${formatHundredths(
        task.rightHundredths,
      )} — is the first less than (lt), equal to (eq), or greater than (gt) the second?`,
      options: ['lt', 'eq', 'gt'],
    };
  }
  if (task.kind === 'decimal_round_tenth') {
    return {
      question: `Round ${formatHundredths(task.hundredths)} to the nearest tenth.`,
      options: [] /* type the decimal, e.g. 2.5 */,
    };
  }
  if (task.kind === 'fraction_addsub_like') {
    const sign = task.op === '+' ? '+' : '−';
    return {
      question: `What is ${task.leftNum}/${task.denom} ${sign} ${task.rightNum}/${task.denom}? Write your answer as a fraction, like "3/5".`,
      options: [] /* type "n/d" */,
    };
  }
  if (task.kind === 'mult_2x2') {
    return {
      question: `What is ${task.factorA} × ${task.factorB}?`,
      options: [] /* type the number */,
    };
  }
  if (task.kind === 'division_2digit') {
    return {
      question: `What is ${task.dividend} ÷ ${task.divisor}? Give the quotient and the remainder, like "20 7".`,
      options: [] /* type "quotient remainder" */,
    };
  }
  if (task.kind === 'fraction_percent_equiv') {
    return {
      question: `Is ${task.numerator}/${task.denominator} equal in value to ${task.percent}%? (yes / no)`,
      options: ['yes', 'no'],
    };
  }
  if (task.kind === 'parallelogram_area') {
    return {
      question: `A parallelogram has base ${task.base} and height ${task.height}. What is its area (square units)?`,
      options: [] /* type the number */,
    };
  }
  if (task.kind === 'triangle_area') {
    return {
      question: `A triangle has base ${task.base} and height ${task.height}. What is its area (square units)?`,
      options: [] /* type the number */,
    };
  }
  if (task.kind === 'integer_signed_compare') {
    return {
      question: `Compare ${task.left} and ${task.right} — is the first less than (lt), equal to (eq), or greater than (gt) the second?`,
      options: ['lt', 'eq', 'gt'],
    };
  }
  if (task.kind === 'decimal_thousandth_compare') {
    return {
      question: `Compare ${formatThousandths(task.leftThousandths)} and ${formatThousandths(
        task.rightThousandths,
      )} — is the first less than (lt), equal to (eq), or greater than (gt) the second?`,
      options: ['lt', 'eq', 'gt'],
    };
  }
  if (task.kind === 'decimal_round_hundredth') {
    return {
      question: `Round ${formatThousandths(task.thousandths)} to the nearest hundredth.`,
      options: [] /* type the decimal, e.g. 2.48 */,
    };
  }
  if (task.kind === 'fraction_addsub_unlike') {
    const sign = task.op === '+' ? '+' : '−';
    return {
      question: `What is ${task.leftNum}/${task.leftDenom} ${sign} ${task.rightNum}/${task.rightDenom}? Write your answer as a fraction, like "3/5".`,
      options: [] /* type "n/d" */,
    };
  }
  if (task.kind === 'percent_of') {
    return {
      question: `What is ${task.percent}% of ${task.whole}?`,
      options: [] /* type the number */,
    };
  }
  if (task.kind === 'perfect_square_root') {
    return {
      question: `What is the square root of ${task.square}?`,
      options: [] /* type the number */,
    };
  }
  if (task.kind === 'is_perfect_square') {
    return {
      question: `Is ${task.value} a perfect square? Answer "yes" or "no".`,
      options: [] /* type yes / no */,
    };
  }
  if (task.kind === 'integer_addsub_signed') {
    const r = task.right < 0 ? `(${task.right})` : `${task.right}`;
    return {
      question: `What is ${task.left} ${task.op} ${r}? Use a negative sign if the answer is below zero.`,
      options: [] /* type the (possibly negative) integer */,
    };
  }
  if (task.kind === 'power_eval') {
    return {
      question: `What is ${task.base} to the power of ${task.exponent} (${task.base}^${task.exponent})?`,
      options: [] /* type the number */,
    };
  }
  if (task.kind === 'gcf_pair') {
    return {
      question: `What is the greatest common factor (GCF) of ${task.a} and ${task.b}?`,
      options: [] /* type the number */,
    };
  }
  if (task.kind === 'lcm_pair') {
    return {
      question: `What is the lowest common multiple (LCM) of ${task.a} and ${task.b}?`,
      options: [] /* type the number */,
    };
  }
  if (task.kind === 'fraction_muldiv') {
    return {
      question: `What is ${task.leftNum}/${task.leftDenom} ${task.op} ${task.rightNum}/${task.rightDenom}? Write your answer as a fraction, like "3/5".`,
      options: [] /* type "n/d" */,
    };
  }
  if (task.kind === 'decimal_muldiv') {
    return {
      question: `What is ${formatHundredths(task.leftHundredths)} ${task.op} ${formatHundredths(task.rightHundredths)}?`,
      options: [] /* type the decimal */,
    };
  }
  if (task.kind === 'proportion_solve') {
    return {
      question: `Solve for the missing number: ${task.a}/${task.b} = ${task.c}/? — what is the missing number?`,
      options: [] /* type the number */,
    };
  }
  if (task.kind === 'integer_muldiv_signed') {
    const r = task.right < 0 ? `(${task.right})` : `${task.right}`;
    return {
      question: `What is ${task.left} ${task.op} ${r}? Use a negative sign if the answer is below zero.`,
      options: [] /* type the (possibly negative) integer */,
    };
  }
  if (task.kind === 'power_of_ten_scale') {
    const factor = Math.pow(10, task.exponent);
    return {
      question: `What is ${formatThousandths(task.valueThousandths)} ${task.op} ${factor}?`,
      options: [] /* type the decimal */,
    };
  }
  if (task.kind === 'sqrt_between') {
    return {
      question: `The square root of ${task.value} is between two consecutive whole numbers. Enter the smaller one.`,
      options: [] /* type the number */,
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
  if (task.kind === 'decimal_tenth_compare') {
    return checkDecimalCompareTask({
      kind: 'decimal_tenth_compare',
      leftTenths: task.leftTenths,
      rightTenths: task.rightTenths,
      claimedRelation: decimalRelation(task.leftTenths, task.rightTenths),
    }).correct;
  }
  if (task.kind === 'decimal_round_whole') {
    return checkDecimalRoundTask({
      kind: 'decimal_round_whole',
      tenths: task.tenths,
      claimedWhole: roundTenthsToWhole(task.tenths),
    }).correct;
  }
  if (task.kind === 'fraction_decimal_equiv') {
    return checkFractionDecimalEquivTask({
      kind: 'fraction_decimal_equiv',
      numerator: task.numerator,
      denominator: task.denominator,
      tenths: task.tenths,
      claimedEquivalent: task.numerator * 10 === task.tenths * task.denominator,
    }).correct;
  }
  if (task.kind === 'rectangle_area') {
    return checkRectangleAreaTask({
      kind: 'rectangle_area',
      length: task.length,
      width: task.width,
      claimedArea: rectangleArea(task.length, task.width),
    }).correct;
  }
  if (task.kind === 'rectangle_missing_side') {
    return checkRectangleMissingSideTask({
      kind: 'rectangle_missing_side',
      area: task.area,
      knownSide: task.knownSide,
      claimedSide: task.area / task.knownSide,
    }).correct;
  }
  if (task.kind === 'decimal_hundredth_compare') {
    return checkDecimalHundredthCompareTask({
      kind: 'decimal_hundredth_compare',
      leftHundredths: task.leftHundredths,
      rightHundredths: task.rightHundredths,
      claimedRelation: hundredthsRelation(task.leftHundredths, task.rightHundredths),
    }).correct;
  }
  if (task.kind === 'decimal_round_tenth') {
    return checkDecimalRoundTenthTask({
      kind: 'decimal_round_tenth',
      hundredths: task.hundredths,
      claimedHundredths: roundHundredthsToTenth(task.hundredths),
    }).correct;
  }
  if (task.kind === 'fraction_addsub_like') {
    const resultNum = fractionAddSubResultNum(task.leftNum, task.rightNum, task.op);
    if (resultNum === null) return false;
    return checkFractionAddSubLikeTask({
      kind: 'fraction_addsub_like',
      leftNum: task.leftNum,
      rightNum: task.rightNum,
      denom: task.denom,
      op: task.op,
      claimedNum: resultNum,
      claimedDenom: task.denom,
    }).correct;
  }
  if (task.kind === 'mult_2x2') {
    return checkMult2x2Task({
      kind: 'mult_2x2',
      factorA: task.factorA,
      factorB: task.factorB,
      claimedProduct: task.factorA * task.factorB,
    }).correct;
  }
  if (task.kind === 'division_2digit') {
    return checkDivision2DigitTask({
      kind: 'division_2digit',
      dividend: task.dividend,
      divisor: task.divisor,
      claimedQuotient: Math.floor(task.dividend / task.divisor),
      claimedRemainder: task.dividend % task.divisor,
    }).correct;
  }
  if (task.kind === 'fraction_percent_equiv') {
    return checkFractionPercentEquivTask({
      kind: 'fraction_percent_equiv',
      numerator: task.numerator,
      denominator: task.denominator,
      percent: task.percent,
      claimedEquivalent: task.numerator * 100 === task.percent * task.denominator,
    }).correct;
  }
  if (task.kind === 'parallelogram_area') {
    return checkParallelogramAreaTask({
      kind: 'parallelogram_area',
      base: task.base,
      height: task.height,
      claimedArea: parallelogramArea(task.base, task.height),
    }).correct;
  }
  if (task.kind === 'triangle_area') {
    return checkTriangleAreaTask({
      kind: 'triangle_area',
      base: task.base,
      height: task.height,
      claimedArea: (task.base * task.height) / 2,
    }).correct;
  }
  if (task.kind === 'integer_signed_compare') {
    return checkSignedIntegerCompareTask({
      kind: 'integer_signed_compare',
      left: task.left,
      right: task.right,
      claimedRelation: signedRelation(task.left, task.right),
    }).correct;
  }
  if (task.kind === 'decimal_thousandth_compare') {
    return checkDecimalThousandthCompareTask({
      kind: 'decimal_thousandth_compare',
      leftThousandths: task.leftThousandths,
      rightThousandths: task.rightThousandths,
      claimedRelation: thousandthsRelation(task.leftThousandths, task.rightThousandths),
    }).correct;
  }
  if (task.kind === 'decimal_round_hundredth') {
    return checkDecimalRoundHundredthTask({
      kind: 'decimal_round_hundredth',
      thousandths: task.thousandths,
      claimedThousandths: roundThousandthsToHundredth(task.thousandths),
    }).correct;
  }
  if (task.kind === 'fraction_addsub_unlike') {
    const result = fractionAddSubUnlikeResult(
      task.leftNum,
      task.leftDenom,
      task.rightNum,
      task.rightDenom,
      task.op,
    );
    if (result === null) return false;
    return checkFractionAddSubUnlikeTask({
      kind: 'fraction_addsub_unlike',
      leftNum: task.leftNum,
      leftDenom: task.leftDenom,
      rightNum: task.rightNum,
      rightDenom: task.rightDenom,
      op: task.op,
      claimedNum: result.num,
      claimedDenom: result.denom,
    }).correct;
  }
  if (task.kind === 'percent_of') {
    const result = percentOfResult(task.percent, task.whole);
    if (result === null) return false;
    return checkPercentOfTask({
      kind: 'percent_of',
      percent: task.percent,
      whole: task.whole,
      claimedResult: result,
    }).correct;
  }
  if (task.kind === 'perfect_square_root') {
    const root = exactSqrt(task.square);
    if (root === null) return false;
    return checkPerfectSquareRootTask({
      kind: 'perfect_square_root',
      square: task.square,
      claimedRoot: root,
    }).correct;
  }
  if (task.kind === 'is_perfect_square') {
    return checkIsPerfectSquareTask({
      kind: 'is_perfect_square',
      value: task.value,
      claimedIsSquare: isPerfectSquare(task.value),
    }).correct;
  }
  if (task.kind === 'integer_addsub_signed') {
    return checkIntegerAddSubTask({
      kind: 'integer_addsub_signed',
      left: task.left,
      right: task.right,
      op: task.op,
      claimedResult: integerAddSubResult(task.left, task.right, task.op),
    }).correct;
  }
  if (task.kind === 'power_eval') {
    const value = powerValue(task.base, task.exponent);
    if (value === null) return false;
    return checkPowerEvalTask({
      kind: 'power_eval',
      base: task.base,
      exponent: task.exponent,
      claimedResult: value,
    }).correct;
  }
  if (task.kind === 'gcf_pair') {
    return checkGcfPairTask({
      kind: 'gcf_pair',
      a: task.a,
      b: task.b,
      claimedResult: gcd(task.a, task.b),
    }).correct;
  }
  if (task.kind === 'lcm_pair') {
    return checkLcmPairTask({
      kind: 'lcm_pair',
      a: task.a,
      b: task.b,
      claimedResult: lcm(task.a, task.b),
    }).correct;
  }
  if (task.kind === 'fraction_muldiv') {
    const result = fractionMulDivResult(
      task.leftNum,
      task.leftDenom,
      task.rightNum,
      task.rightDenom,
      task.op,
    );
    if (result === null) return false;
    return checkFractionMulDivTask({
      kind: 'fraction_muldiv',
      leftNum: task.leftNum,
      leftDenom: task.leftDenom,
      rightNum: task.rightNum,
      rightDenom: task.rightDenom,
      op: task.op,
      claimedNum: result.num,
      claimedDenom: result.denom,
    }).correct;
  }
  if (task.kind === 'decimal_muldiv') {
    const expected = decimalMulDivTenThousandths(
      task.op,
      task.leftHundredths,
      task.rightHundredths,
    );
    if (expected === null) return false;
    return checkDecimalMulDivTask({
      kind: 'decimal_muldiv',
      op: task.op,
      leftHundredths: task.leftHundredths,
      rightHundredths: task.rightHundredths,
      claimedTenThousandths: expected,
    }).correct;
  }
  if (task.kind === 'proportion_solve') {
    const x = proportionSolve(task.a, task.b, task.c);
    if (x === null) return false;
    return checkProportionSolveTask({
      kind: 'proportion_solve',
      a: task.a,
      b: task.b,
      c: task.c,
      claimedX: x,
    }).correct;
  }
  if (task.kind === 'integer_muldiv_signed') {
    const result = integerMulDivResult(task.left, task.right, task.op);
    if (result === null) return false;
    return checkIntegerMulDivTask({
      kind: 'integer_muldiv_signed',
      left: task.left,
      right: task.right,
      op: task.op,
      claimedResult: result,
    }).correct;
  }
  if (task.kind === 'power_of_ten_scale') {
    const expected = powerOfTenScaleThousandths(task.op, task.valueThousandths, task.exponent);
    if (expected === null) return false;
    return checkPowerOfTenScaleTask({
      kind: 'power_of_ten_scale',
      op: task.op,
      valueThousandths: task.valueThousandths,
      exponent: task.exponent,
      claimedThousandths: expected,
    }).correct;
  }
  if (task.kind === 'sqrt_between') {
    return checkSqrtBetweenTask({
      kind: 'sqrt_between',
      value: task.value,
      claimedLower: floorSqrt(task.value),
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
  if (task.kind === 'decimal_tenth_compare') return isRelation(a); // lt / eq / gt
  if (task.kind === 'decimal_round_whole') return /^\d+$/.test(a); // a non-negative integer
  if (task.kind === 'fraction_decimal_equiv') return a === 'yes' || a === 'no';
  if (task.kind === 'rectangle_area') return /^\d+$/.test(a); // a non-negative integer
  if (task.kind === 'rectangle_missing_side') return /^\d+$/.test(a); // a non-negative integer
  if (task.kind === 'decimal_hundredth_compare') return isRelation(a); // lt / eq / gt
  if (task.kind === 'decimal_round_tenth') return parseToHundredths(a) !== null; // a decimal
  if (task.kind === 'fraction_addsub_like') return parseFraction(a) !== null; // "n/d"
  if (task.kind === 'mult_2x2') return /^\d+$/.test(a); // a non-negative integer
  if (task.kind === 'division_2digit') return parseQuotientRemainder(a) !== null; // "q r"
  if (task.kind === 'fraction_percent_equiv') return a === 'yes' || a === 'no';
  if (task.kind === 'parallelogram_area') return /^\d+$/.test(a); // a non-negative integer
  if (task.kind === 'triangle_area') return /^\d+$/.test(a); // a non-negative integer
  if (task.kind === 'integer_signed_compare') return isRelation(a); // lt / eq / gt
  if (task.kind === 'decimal_thousandth_compare') return isRelation(a); // lt / eq / gt
  if (task.kind === 'decimal_round_hundredth') return parseToThousandths(a) !== null; // a decimal
  if (task.kind === 'fraction_addsub_unlike') return parseFraction(a) !== null; // "n/d"
  if (task.kind === 'percent_of') return /^\d+$/.test(a); // a non-negative integer
  if (task.kind === 'perfect_square_root') return /^\d+$/.test(a); // a non-negative integer
  if (task.kind === 'is_perfect_square') return a === 'yes' || a === 'no';
  if (task.kind === 'integer_addsub_signed') return parseSignedInt(a) !== null; // signed integer
  if (task.kind === 'power_eval') return /^\d+$/.test(a); // a non-negative integer
  if (task.kind === 'gcf_pair' || task.kind === 'lcm_pair') return /^\d+$/.test(a); // positive integer
  if (task.kind === 'fraction_muldiv') return parseFraction(a) !== null; // "n/d"
  if (task.kind === 'decimal_muldiv') return parseToTenThousandths(a) !== null; // a decimal (≤4 dp)
  if (task.kind === 'proportion_solve') return /^\d+$/.test(a); // a positive integer
  if (task.kind === 'integer_muldiv_signed') return parseSignedInt(a) !== null; // signed integer
  if (task.kind === 'power_of_ten_scale') return parseToThousandths(a) !== null; // a decimal (≤3 dp)
  if (task.kind === 'sqrt_between') return /^\d+$/.test(a); // a non-negative integer
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
  if (task.kind === 'decimal_tenth_compare') {
    return checkDecimalCompareTask({
      kind: 'decimal_tenth_compare',
      leftTenths: task.leftTenths,
      rightTenths: task.rightTenths,
      claimedRelation: a as DecimalRelation,
    }).correct;
  }
  if (task.kind === 'decimal_round_whole') {
    return checkDecimalRoundTask({
      kind: 'decimal_round_whole',
      tenths: task.tenths,
      claimedWhole: Number(a),
    }).correct;
  }
  if (task.kind === 'fraction_decimal_equiv') {
    return checkFractionDecimalEquivTask({
      kind: 'fraction_decimal_equiv',
      numerator: task.numerator,
      denominator: task.denominator,
      tenths: task.tenths,
      claimedEquivalent: a === 'yes',
    }).correct;
  }
  if (task.kind === 'rectangle_area') {
    return checkRectangleAreaTask({
      kind: 'rectangle_area',
      length: task.length,
      width: task.width,
      claimedArea: Number(a),
    }).correct;
  }
  if (task.kind === 'rectangle_missing_side') {
    return checkRectangleMissingSideTask({
      kind: 'rectangle_missing_side',
      area: task.area,
      knownSide: task.knownSide,
      claimedSide: Number(a),
    }).correct;
  }
  if (task.kind === 'decimal_hundredth_compare') {
    return checkDecimalHundredthCompareTask({
      kind: 'decimal_hundredth_compare',
      leftHundredths: task.leftHundredths,
      rightHundredths: task.rightHundredths,
      claimedRelation: a as DecimalRelation,
    }).correct;
  }
  if (task.kind === 'decimal_round_tenth') {
    const parsed = parseToHundredths(a);
    if (parsed === null) return false;
    return checkDecimalRoundTenthTask({
      kind: 'decimal_round_tenth',
      hundredths: task.hundredths,
      claimedHundredths: parsed,
    }).correct;
  }
  if (task.kind === 'fraction_addsub_like') {
    const parsed = parseFraction(a);
    if (!parsed) return false;
    return checkFractionAddSubLikeTask({
      kind: 'fraction_addsub_like',
      leftNum: task.leftNum,
      rightNum: task.rightNum,
      denom: task.denom,
      op: task.op,
      claimedNum: parsed.num,
      claimedDenom: parsed.denom,
    }).correct;
  }
  if (task.kind === 'mult_2x2') {
    return checkMult2x2Task({
      kind: 'mult_2x2',
      factorA: task.factorA,
      factorB: task.factorB,
      claimedProduct: Number(a),
    }).correct;
  }
  if (task.kind === 'division_2digit') {
    const parsed = parseQuotientRemainder(a);
    if (!parsed) return false;
    return checkDivision2DigitTask({
      kind: 'division_2digit',
      dividend: task.dividend,
      divisor: task.divisor,
      claimedQuotient: parsed.q,
      claimedRemainder: parsed.r,
    }).correct;
  }
  if (task.kind === 'fraction_percent_equiv') {
    return checkFractionPercentEquivTask({
      kind: 'fraction_percent_equiv',
      numerator: task.numerator,
      denominator: task.denominator,
      percent: task.percent,
      claimedEquivalent: a === 'yes',
    }).correct;
  }
  if (task.kind === 'parallelogram_area') {
    return checkParallelogramAreaTask({
      kind: 'parallelogram_area',
      base: task.base,
      height: task.height,
      claimedArea: Number(a),
    }).correct;
  }
  if (task.kind === 'triangle_area') {
    return checkTriangleAreaTask({
      kind: 'triangle_area',
      base: task.base,
      height: task.height,
      claimedArea: Number(a),
    }).correct;
  }
  if (task.kind === 'integer_signed_compare') {
    return checkSignedIntegerCompareTask({
      kind: 'integer_signed_compare',
      left: task.left,
      right: task.right,
      claimedRelation: a as SignedRelation,
    }).correct;
  }
  if (task.kind === 'decimal_thousandth_compare') {
    return checkDecimalThousandthCompareTask({
      kind: 'decimal_thousandth_compare',
      leftThousandths: task.leftThousandths,
      rightThousandths: task.rightThousandths,
      claimedRelation: a as SignedRelation,
    }).correct;
  }
  if (task.kind === 'decimal_round_hundredth') {
    const parsed = parseToThousandths(a);
    if (parsed === null) return false;
    return checkDecimalRoundHundredthTask({
      kind: 'decimal_round_hundredth',
      thousandths: task.thousandths,
      claimedThousandths: parsed,
    }).correct;
  }
  if (task.kind === 'fraction_addsub_unlike') {
    const parsed = parseFraction(a);
    if (!parsed) return false;
    return checkFractionAddSubUnlikeTask({
      kind: 'fraction_addsub_unlike',
      leftNum: task.leftNum,
      leftDenom: task.leftDenom,
      rightNum: task.rightNum,
      rightDenom: task.rightDenom,
      op: task.op,
      claimedNum: parsed.num,
      claimedDenom: parsed.denom,
    }).correct;
  }
  if (task.kind === 'percent_of') {
    return checkPercentOfTask({
      kind: 'percent_of',
      percent: task.percent,
      whole: task.whole,
      claimedResult: Number(a),
    }).correct;
  }
  if (task.kind === 'perfect_square_root') {
    return checkPerfectSquareRootTask({
      kind: 'perfect_square_root',
      square: task.square,
      claimedRoot: Number(a),
    }).correct;
  }
  if (task.kind === 'is_perfect_square') {
    return checkIsPerfectSquareTask({
      kind: 'is_perfect_square',
      value: task.value,
      claimedIsSquare: a === 'yes',
    }).correct;
  }
  if (task.kind === 'integer_addsub_signed') {
    const parsed = parseSignedInt(a);
    if (parsed === null) return false;
    return checkIntegerAddSubTask({
      kind: 'integer_addsub_signed',
      left: task.left,
      right: task.right,
      op: task.op,
      claimedResult: parsed,
    }).correct;
  }
  if (task.kind === 'power_eval') {
    return checkPowerEvalTask({
      kind: 'power_eval',
      base: task.base,
      exponent: task.exponent,
      claimedResult: Number(a),
    }).correct;
  }
  if (task.kind === 'gcf_pair') {
    return checkGcfPairTask({
      kind: 'gcf_pair',
      a: task.a,
      b: task.b,
      claimedResult: Number(a),
    }).correct;
  }
  if (task.kind === 'lcm_pair') {
    return checkLcmPairTask({
      kind: 'lcm_pair',
      a: task.a,
      b: task.b,
      claimedResult: Number(a),
    }).correct;
  }
  if (task.kind === 'fraction_muldiv') {
    const parsed = parseFraction(a);
    if (!parsed) return false;
    return checkFractionMulDivTask({
      kind: 'fraction_muldiv',
      leftNum: task.leftNum,
      leftDenom: task.leftDenom,
      rightNum: task.rightNum,
      rightDenom: task.rightDenom,
      op: task.op,
      claimedNum: parsed.num,
      claimedDenom: parsed.denom,
    }).correct;
  }
  if (task.kind === 'decimal_muldiv') {
    const parsed = parseToTenThousandths(a);
    if (parsed === null) return false;
    return checkDecimalMulDivTask({
      kind: 'decimal_muldiv',
      op: task.op,
      leftHundredths: task.leftHundredths,
      rightHundredths: task.rightHundredths,
      claimedTenThousandths: parsed,
    }).correct;
  }
  if (task.kind === 'proportion_solve') {
    return checkProportionSolveTask({
      kind: 'proportion_solve',
      a: task.a,
      b: task.b,
      c: task.c,
      claimedX: Number(a),
    }).correct;
  }
  if (task.kind === 'integer_muldiv_signed') {
    const parsed = parseSignedInt(a);
    if (parsed === null) return false;
    return checkIntegerMulDivTask({
      kind: 'integer_muldiv_signed',
      left: task.left,
      right: task.right,
      op: task.op,
      claimedResult: parsed,
    }).correct;
  }
  if (task.kind === 'power_of_ten_scale') {
    const parsed = parseToThousandths(a);
    if (parsed === null) return false;
    return checkPowerOfTenScaleTask({
      kind: 'power_of_ten_scale',
      op: task.op,
      valueThousandths: task.valueThousandths,
      exponent: task.exponent,
      claimedThousandths: parsed,
    }).correct;
  }
  if (task.kind === 'sqrt_between') {
    return checkSqrtBetweenTask({
      kind: 'sqrt_between',
      value: task.value,
      claimedLower: Number(a),
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
    case 'decimal_tenth_compare':
      return decimalRelation(task.leftTenths, task.rightTenths);
    case 'decimal_round_whole':
      return String(roundTenthsToWhole(task.tenths));
    case 'fraction_decimal_equiv':
      return task.numerator * 10 === task.tenths * task.denominator ? 'yes' : 'no';
    case 'rectangle_area':
      return String(rectangleArea(task.length, task.width));
    case 'rectangle_missing_side':
      return String(task.area / task.knownSide);
    case 'decimal_hundredth_compare':
      return hundredthsRelation(task.leftHundredths, task.rightHundredths);
    case 'decimal_round_tenth':
      return formatHundredths(roundHundredthsToTenth(task.hundredths));
    case 'fraction_addsub_like':
      return `${fractionAddSubResultNum(task.leftNum, task.rightNum, task.op) ?? 0}/${task.denom}`;
    case 'mult_2x2':
      return String(task.factorA * task.factorB);
    case 'division_2digit':
      return `${Math.floor(task.dividend / task.divisor)} ${task.dividend % task.divisor}`;
    case 'fraction_percent_equiv':
      return task.numerator * 100 === task.percent * task.denominator ? 'yes' : 'no';
    case 'parallelogram_area':
      return String(parallelogramArea(task.base, task.height));
    case 'triangle_area':
      return String((task.base * task.height) / 2);
    case 'integer_signed_compare':
      return signedRelation(task.left, task.right);
    case 'decimal_thousandth_compare':
      return thousandthsRelation(task.leftThousandths, task.rightThousandths);
    case 'decimal_round_hundredth':
      return formatThousandths(roundThousandthsToHundredth(task.thousandths));
    case 'fraction_addsub_unlike': {
      const r = fractionAddSubUnlikeResult(
        task.leftNum,
        task.leftDenom,
        task.rightNum,
        task.rightDenom,
        task.op,
      );
      return `${r?.num ?? 0}/${r?.denom ?? task.leftDenom * task.rightDenom}`;
    }
    case 'percent_of':
      return String(percentOfResult(task.percent, task.whole) ?? 0);
    case 'perfect_square_root':
      return String(exactSqrt(task.square) ?? 0);
    case 'is_perfect_square':
      return isPerfectSquare(task.value) ? 'yes' : 'no';
    case 'integer_addsub_signed':
      return String(integerAddSubResult(task.left, task.right, task.op));
    case 'power_eval':
      return String(powerValue(task.base, task.exponent) ?? 0);
    case 'gcf_pair':
      return String(gcd(task.a, task.b));
    case 'lcm_pair':
      return String(lcm(task.a, task.b));
    case 'fraction_muldiv': {
      const r = fractionMulDivResult(
        task.leftNum,
        task.leftDenom,
        task.rightNum,
        task.rightDenom,
        task.op,
      );
      return `${r?.num ?? 0}/${r?.denom ?? task.leftDenom * task.rightDenom}`;
    }
    case 'decimal_muldiv':
      return formatTenThousandths(
        decimalMulDivTenThousandths(task.op, task.leftHundredths, task.rightHundredths) ?? 0,
      );
    case 'proportion_solve':
      return String(proportionSolve(task.a, task.b, task.c) ?? 0);
    case 'integer_muldiv_signed':
      return String(integerMulDivResult(task.left, task.right, task.op) ?? 0);
    case 'power_of_ten_scale':
      return formatThousandths(
        powerOfTenScaleThousandths(task.op, task.valueThousandths, task.exponent) ?? 0,
      );
    case 'sqrt_between':
      return String(floorSqrt(task.value));
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
    case 'decimal_tenth_compare':
      // Any relation other than the true one (eq → lt is wrong too).
      return decimalRelation(task.leftTenths, task.rightTenths) === 'lt' ? 'gt' : 'lt';
    case 'decimal_round_whole': {
      // Truncate instead of round (drop the tenths). Fall back to one-off when
      // the value already sits on a whole, so the "wrong" answer is always wrong.
      const rounded = roundTenthsToWhole(task.tenths);
      const truncated = Math.floor(task.tenths / 10);
      return String(truncated === rounded ? rounded + 1 : truncated);
    }
    case 'fraction_decimal_equiv':
      return task.numerator * 10 === task.tenths * task.denominator ? 'no' : 'yes';
    case 'rectangle_area': {
      // The perimeter/adds-the-sides error (length + width) instead of area.
      // Fall back to one-off if that coincides with the product, so it is always wrong.
      const area = rectangleArea(task.length, task.width);
      const sum = task.length + task.width;
      return String(sum === area ? area + 1 : sum);
    }
    case 'rectangle_missing_side': {
      // Multiply instead of divide (area × known side). Always larger than the
      // true side for a valid item, so always wrong.
      return String(task.area * task.knownSide);
    }
    case 'decimal_hundredth_compare':
      // Any relation other than the true one (eq → lt is wrong too).
      return hundredthsRelation(task.leftHundredths, task.rightHundredths) === 'lt' ? 'gt' : 'lt';
    case 'decimal_round_tenth': {
      // Truncate to the tenth instead of rounding (drop the hundredths digit).
      // Fall back one tenth up if the value already sits on a tenth, so it is
      // always a valid, wrong decimal string.
      const rounded = roundHundredthsToTenth(task.hundredths);
      const truncated = Math.floor(task.hundredths / 10) * 10;
      return formatHundredths(truncated === rounded ? rounded + 10 : truncated);
    }
    case 'fraction_addsub_like': {
      // The "added the denominators too" error — correct numerator over a doubled
      // denominator (value-wrong). Fall back for a zero result so it is always wrong.
      const resultNum = fractionAddSubResultNum(task.leftNum, task.rightNum, task.op) ?? 0;
      return resultNum === 0 ? `1/${task.denom}` : `${resultNum}/${task.denom * 2}`;
    }
    case 'mult_2x2':
      // The ones-digit-only partial-product error (ones of A × B). Always smaller
      // than the true product for two-digit factors, so always wrong.
      return String((task.factorA % 10) * task.factorB);
    case 'division_2digit': {
      // The drops-the-remainder error — right quotient, remainder reported as 0.
      // Fall back to a wrong quotient when the true remainder is already 0.
      const q = Math.floor(task.dividend / task.divisor);
      const r = task.dividend % task.divisor;
      return r === 0 ? `${q + 1} 0` : `${q} 0`;
    }
    case 'fraction_percent_equiv':
      return task.numerator * 100 === task.percent * task.denominator ? 'no' : 'yes';
    case 'parallelogram_area': {
      // The adds-the-sides error (base + height) instead of base × height. Fall
      // back to one-off if that coincides with the product, so it is always wrong.
      const area = parallelogramArea(task.base, task.height);
      const sum = task.base + task.height;
      return String(sum === area ? area + 1 : sum);
    }
    case 'triangle_area':
      // The forgot-to-halve error (base × height) — always larger than the true
      // half for a valid item, so always wrong.
      return String(task.base * task.height);
    case 'integer_signed_compare':
      // Any relation other than the true one (eq → lt is wrong too).
      return signedRelation(task.left, task.right) === 'lt' ? 'gt' : 'lt';
    case 'decimal_thousandth_compare':
      return thousandthsRelation(task.leftThousandths, task.rightThousandths) === 'lt'
        ? 'gt'
        : 'lt';
    case 'decimal_round_hundredth': {
      // Truncate to the hundredth instead of rounding (drop the thousandths digit).
      const rounded = roundThousandthsToHundredth(task.thousandths);
      const truncated = Math.floor(task.thousandths / 10) * 10;
      return formatThousandths(truncated === rounded ? rounded + 10 : truncated);
    }
    case 'fraction_addsub_unlike': {
      // The "added (or subtracted) straight across" error — numerators over
      // combined denominators, without finding a common denominator. The true
      // result (over the product denominator) is the guaranteed-wrong fallback
      // nudged by one when the misconception happens to coincide in value.
      const r = fractionAddSubUnlikeResult(
        task.leftNum,
        task.leftDenom,
        task.rightNum,
        task.rightDenom,
        task.op,
      ) ?? { num: 0, denom: task.leftDenom * task.rightDenom };
      const acrossNum =
        task.op === '+' ? task.leftNum + task.rightNum : task.leftNum - task.rightNum;
      const acrossDenom =
        task.op === '+' ? task.leftDenom + task.rightDenom : task.leftDenom - task.rightDenom;
      const acrossValid = acrossNum >= 0 && acrossDenom > 0;
      // across is wrong iff acrossNum/acrossDenom != r.num/r.denom (cross-multiply)
      const acrossWrong = acrossValid && acrossNum * r.denom !== r.num * acrossDenom;
      return acrossWrong ? `${acrossNum}/${acrossDenom}` : `${r.num + 1}/${r.denom}`;
    }
    case 'percent_of': {
      // The "divided by 10 instead of 100" place-value slip — ten times the true
      // value. Fall back to true+1 if the product is not divisible by 10 or the
      // slip happens to coincide (only when the true result is 0).
      const trueResult = percentOfResult(task.percent, task.whole) ?? 0;
      const product = task.whole * task.percent;
      const slip = product % 10 === 0 ? product / 10 : -1;
      return slip >= 0 && slip !== trueResult ? String(slip) : String(trueResult + 1);
    }
    case 'perfect_square_root': {
      // An off-by-one root — a clean non-negative integer that is never the true
      // root (root−1, or root+1 when the root is 0).
      const root = exactSqrt(task.square) ?? 0;
      return String(root > 0 ? root - 1 : root + 1);
    }
    case 'is_perfect_square':
      // The opposite judgement.
      return isPerfectSquare(task.value) ? 'no' : 'yes';
    case 'integer_addsub_signed': {
      // The "ignored the signs / wrong-direction" error — one off the true value
      // (always a valid integer and never correct).
      return String(integerAddSubResult(task.left, task.right, task.op) + 1);
    }
    case 'power_eval': {
      // The "multiplied the base by the exponent" error (base·exp instead of
      // base^exp). Fall back to true+1 on the rare coincidence (e.g. exp 1).
      const trueVal = powerValue(task.base, task.exponent) ?? 0;
      const product = task.base * task.exponent;
      return String(product !== trueVal ? product : trueVal + 1);
    }
    case 'gcf_pair': {
      // The "confused GCF with LCM" error — the LCM is wrong whenever the two
      // numbers are not equal; fall back to gcf+1 when they coincide (a === b).
      const g = gcd(task.a, task.b);
      const l = lcm(task.a, task.b);
      return String(l !== g ? l : g + 1);
    }
    case 'lcm_pair': {
      // The "confused LCM with GCF" error — the GCF is wrong whenever the two
      // numbers are not equal; fall back to lcm+1 when they coincide (a === b).
      const g = gcd(task.a, task.b);
      const l = lcm(task.a, task.b);
      return String(g !== l ? g : l + 1);
    }
    case 'fraction_muldiv': {
      // The "wrong operation" error: for ÷ multiply straight across (forgot the
      // reciprocal); for × flip the divisor (reciprocal by mistake). Fall back to
      // true+1/denom on the rare coincidence.
      const r = fractionMulDivResult(
        task.leftNum,
        task.leftDenom,
        task.rightNum,
        task.rightDenom,
        task.op,
      ) ?? { num: 0, denom: task.leftDenom * task.rightDenom };
      const cand =
        task.op === '÷'
          ? { num: task.leftNum * task.rightNum, denom: task.leftDenom * task.rightDenom }
          : { num: task.leftNum * task.rightDenom, denom: task.leftDenom * task.rightNum };
      const candWrong =
        cand.num >= 0 && cand.denom > 0 && cand.num * r.denom !== r.num * cand.denom;
      return candWrong ? `${cand.num}/${cand.denom}` : `${r.num + 1}/${r.denom}`;
    }
    case 'decimal_muldiv': {
      // The "misplaced decimal point" error — ten times the true value (a valid
      // ≤4dp decimal, never correct); fall back to +0.0001 when the result is 0.
      const expected =
        decimalMulDivTenThousandths(task.op, task.leftHundredths, task.rightHundredths) ?? 0;
      return formatTenThousandths(expected > 0 ? expected * 10 : 1);
    }
    case 'proportion_solve': {
      // The "cross-multiplied the wrong pair" error — a·c/b style slip. Compute
      // a different value than the true x; fall back to x+1 on coincidence.
      const x = proportionSolve(task.a, task.b, task.c) ?? 0;
      // b·c swapped to a·c (used the wrong known term): a·c/b when divisible.
      const alt = (task.a * task.c) % task.b === 0 ? (task.a * task.c) / task.b : -1;
      return String(alt >= 1 && alt !== x ? alt : x + 1);
    }
    case 'integer_muldiv_signed': {
      // The "sign-rule" error — correct magnitude, wrong sign (negated true
      // value); fall back to +1 when the true value is 0.
      const v = integerMulDivResult(task.left, task.right, task.op) ?? 0;
      return String(v !== 0 ? -v : 1);
    }
    case 'power_of_ten_scale': {
      // The "shifted the decimal point the wrong way" error — scaled in the
      // opposite direction one step (÷10 where the task multiplies, and vice
      // versa). Always differs from the true value; fall back to +0.001.
      const expected =
        powerOfTenScaleThousandths(task.op, task.valueThousandths, task.exponent) ?? 0;
      const opposite = task.op === '×' ? task.valueThousandths / 10 : task.valueThousandths * 10;
      const oppValid = Number.isInteger(opposite) && opposite >= 0 && opposite !== expected;
      return formatThousandths(oppValid ? opposite : expected + 1);
    }
    case 'sqrt_between':
      // The "picked the upper neighbour" error — the larger of the two
      // consecutive integers (k+1) instead of the smaller (k).
      return String(floorSqrt(task.value) + 1);
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
