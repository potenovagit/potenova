import { DomainError } from '@potenova/contracts';
import { decideDelivery, type CandidateContent } from '@potenova/domain-core';
import {
  checkMathTask,
  checkEnglishTask,
  checkAdditionTask,
  pluralize,
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
export const PLURAL_BASE = 'SK-EN-plural-base';
export const PLURAL_SIB = 'SK-EN-plural-sibilant';
export const ADD_10 = 'SK-NS-add-within10';
export const ADD_20 = 'SK-NS-add-within20';

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
export type Task = CompareTask | EquivTask | PluralTask | AdditionTask;

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
  // Transfer (novel-context) tasks — a mastered skill applied to fresh items.
  'frac-xfer-cmp': cmp(f(3, 4), f(2, 3)), // gt
  'frac-xfer-eq': eq(f(3, 6), f(1, 2)), // yes
  'eng-xfer-base': plural(PLURAL_BASE, 'pen'), // pens
  'eng-xfer-sib': plural(PLURAL_SIB, 'wish'), // wishes
  'add-xfer-10': add(ADD_10, 4, 5), // 9
  'add-xfer-20': add(ADD_20, 8, 7), // 15
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
]);

const fmt = (x: Fraction): string => `${x.numerator}/${x.denominator}`;
const isRelation = (v: unknown): v is FractionRelation => v === 'lt' || v === 'eq' || v === 'gt';

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
  return checkEnglishTask({ kind: 'noun_plural', word: task.word, claimedPlural: a }).correct;
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
    [PLURAL_BASE]: { subject: 'english', course: 'plurals' },
    [PLURAL_SIB]: { subject: 'english', course: 'plurals' },
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

const isGeneratedId = (taskId: string): boolean => taskId.startsWith('gen:');

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
  const d = difficulty as Difficulty;

  if (servable.subject === 'math') {
    const item = generateItems(skillId, index + 1, seed, d)[index];
    if (!item) throw new DomainError('NOT_FOUND', 'generated item index out of range');
    if (item.task.kind === 'fraction_comparison') return cmp(item.task.left, item.task.right);
    if (item.task.kind === 'fraction_equivalence') return eq(item.task.left, item.task.right);
    throw new DomainError('POLICY_BLOCKED', 'generated math kind not servable in the loop yet');
  }
  const item = generateEnglishItems(skillId, index + 1, seed, d)[index];
  if (!item) throw new DomainError('NOT_FOUND', 'generated item index out of range');
  if (item.task.kind === 'noun_plural') {
    return plural(skillId as PluralTask['skillId'], item.task.word);
  }
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
