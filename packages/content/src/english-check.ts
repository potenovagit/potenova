import type { MathCheckReason } from './math-check';

/**
 * Deterministic English oracle (a second subject alongside the Math oracle), to
 * prove the content gate / evidence / planner pipeline is subject-agnostic.
 *
 * Scope: REGULAR noun pluralization only — a closed, rule-decidable task with a
 * single correct answer, so the key can be verified independently before any
 * content reaches a child (AI-001) and a learner answer can be graded without a
 * model. Irregular plurals (child→children) and -f/-o exceptions are out of
 * scope and MUST NOT be put in the task bank; they need a reviewed lexicon.
 *
 * Reason codes are shared with the Math oracle — they are subject-neutral.
 */

/** Regular English plural of a lowercase word (rule-decidable subset). */
export function pluralize(word: string): string {
  const w = word.toLowerCase();
  if (/(s|x|z|ch|sh)$/.test(w)) return `${w}es`; // bus→buses, box→boxes, dish→dishes
  if (/[^aeiou]y$/.test(w)) return `${w.slice(0, -1)}ies`; // baby→babies (consonant + y)
  return `${w}s`; // dog→dogs, key→keys
}

export interface NounPluralTask {
  readonly kind: 'noun_plural';
  readonly word: string;
  readonly claimedPlural: string;
}
export type EnglishTask = NounPluralTask;

export interface EnglishCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

const WORD = /^[a-z]+$/i;

/** Verify a regular-plural answer key (or grade a learner answer the same way). */
export function checkEnglishTask(task: EnglishTask): EnglishCheckResult {
  if (task.kind !== 'noun_plural') {
    return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
  }
  if (!WORD.test(task.word) || !WORD.test(task.claimedPlural)) {
    return { correct: false, ran: false, reason: 'MALFORMED_TASK' };
  }
  const correct = pluralize(task.word) === task.claimedPlural.toLowerCase();
  return { correct, ran: true, reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG' };
}
