import { DomainError } from '@potenova/contracts';
import { decideDelivery, type CandidateContent } from '@potenova/domain-core';
import {
  checkMathTask,
  checkEnglishTask,
  checkAdditionTask,
  checkSubtractionTask,
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
export const SUB_10 = 'SK-NS-sub-within10';
export const SUB_20 = 'SK-NS-sub-within20';

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
interface SubtractionTask {
  readonly subject: 'math';
  readonly course: 'subtraction';
  readonly skillId: typeof SUB_10 | typeof SUB_20;
  readonly kind: 'integer_subtraction';
  readonly a: number;
  readonly b: number;
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
  | SubtractionTask
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
const sub = (skillId: SubtractionTask['skillId'], a: number, b: number): SubtractionTask => ({
  subject: 'math',
  course: 'subtraction',
  skillId,
  kind: 'integer_subtraction',
  a,
  b,
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
  'sub-10-1': sub(SUB_10, 7, 3), // 4
  'sub-10-2': sub(SUB_10, 9, 5), // 4
  'sub-10-3': sub(SUB_10, 8, 2), // 6
  'sub-10-4': sub(SUB_10, 6, 4), // 2
  'sub-20-1': sub(SUB_20, 13, 5), // 8 (crossing ten)
  'sub-20-2': sub(SUB_20, 15, 7), // 8 (crossing ten)
  'sub-20-3': sub(SUB_20, 14, 6), // 8 (crossing ten)
  'sub-20-4': sub(SUB_20, 12, 8), // 4 (crossing ten)
  // Transfer (novel-context) tasks — a mastered skill applied to fresh items.
  'frac-xfer-cmp': cmp(f(3, 4), f(2, 3)), // gt
  'frac-xfer-eq': eq(f(3, 6), f(1, 2)), // yes
  'eng-xfer-base': plural(PLURAL_BASE, 'pen'), // pens
  'eng-xfer-sib': plural(PLURAL_SIB, 'wish'), // wishes
  'add-xfer-10': add(ADD_10, 4, 5), // 9
  'add-xfer-20': add(ADD_20, 8, 7), // 15
  'sub-xfer-10': sub(SUB_10, 9, 4), // 5
  'sub-xfer-20': sub(SUB_20, 16, 9), // 7 (crossing ten)
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
  'sub-xfer-10',
  'sub-xfer-20',
]);

const fmt = (x: Fraction): string => `${x.numerator}/${x.denominator}`;
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
  if (task.kind === 'integer_subtraction') {
    return { question: `What is ${task.a} - ${task.b}?`, options: [] /* type the number */ };
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
  if (task.kind === 'integer_subtraction') {
    return checkSubtractionTask({
      kind: 'integer_subtraction',
      a: task.a,
      b: task.b,
      claimedDifference: task.a - task.b,
    }).correct;
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
  if (task.kind === 'integer_subtraction') return /^\d+$/.test(a); // a non-negative integer
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
  if (task.kind === 'integer_subtraction') {
    return checkSubtractionTask({
      kind: 'integer_subtraction',
      a: task.a,
      b: task.b,
      claimedDifference: Number(a),
    }).correct;
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
    case 'integer_subtraction':
      return String(task.a - task.b);
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
    case 'integer_subtraction':
      // A valid non-negative integer that is one off the true difference; when the
      // difference is 0 the only other non-negative token is 1 (never negative).
      return String(task.a - task.b === 0 ? 1 : task.a - task.b + 1);
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
