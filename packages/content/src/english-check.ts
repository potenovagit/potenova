import type { MathCheckReason } from './math-check';

/**
 * Deterministic English oracle (a second subject alongside the Math oracle), to
 * prove the content gate / evidence / planner pipeline is subject-agnostic.
 *
 * Scope: RULE-DECIDABLE regular morphology only — closed tasks with a single
 * correct answer, so a key can be verified independently before any content
 * reaches a child (AI-001) and a learner answer can be graded without a model:
 *   - regular noun plurals          (dog→dogs, box→boxes, baby→babies)
 *   - regular past tense            (walk→walked, hope→hoped, stop→stopped)
 *   - regular comparative adjective (tall→taller, big→bigger, happy→happier)
 *
 * Irregulars (child→children, go→went, good→better) and multi-syllable doubling
 * exceptions are OUT OF SCOPE and MUST NOT be put in the task bank — they need a
 * reviewed lexicon, not a rule. Generators therefore draw from curated regular
 * word pools; the rules below are correct for those pools.
 *
 * Reason codes are shared with the Math oracle — they are subject-neutral.
 */

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
const isVowel = (c: string): boolean => VOWELS.has(c);

/** Consonant-vowel-consonant ending (final consonant not w/x/y) — the doubling trigger
 *  for one-syllable words. Curated pools keep this to one-syllable stems. */
function isCVC(w: string): boolean {
  if (w.length < 3) return false;
  const a = w[w.length - 3]!;
  const b = w[w.length - 2]!;
  const c = w[w.length - 1]!;
  return !isVowel(a) && isVowel(b) && !isVowel(c) && !['w', 'x', 'y'].includes(c);
}

/** Regular English plural of a lowercase word (rule-decidable subset). */
export function pluralize(word: string): string {
  const w = word.toLowerCase();
  if (/(s|x|z|ch|sh)$/.test(w)) return `${w}es`; // bus→buses, box→boxes, dish→dishes
  if (/[^aeiou]y$/.test(w)) return `${w.slice(0, -1)}ies`; // baby→babies (consonant + y)
  return `${w}s`; // dog→dogs, key→keys
}

/** Regular simple-past of a lowercase verb (rule-decidable subset). */
export function pastTenseRegular(verb: string): string {
  const w = verb.toLowerCase();
  if (/[^aeiou]y$/.test(w)) return `${w.slice(0, -1)}ied`; // carry→carried
  if (w.endsWith('e')) return `${w}d`; // hope→hoped
  if (isCVC(w)) return `${w}${w[w.length - 1]}ed`; // stop→stopped
  return `${w}ed`; // walk→walked, play→played
}

/** Regular comparative of a lowercase adjective (rule-decidable subset). */
export function comparativeRegular(adj: string): string {
  const w = adj.toLowerCase();
  if (/[^aeiou]y$/.test(w)) return `${w.slice(0, -1)}ier`; // happy→happier
  if (w.endsWith('e')) return `${w}r`; // nice→nicer
  if (isCVC(w)) return `${w}${w[w.length - 1]}er`; // big→bigger
  return `${w}er`; // tall→taller
}

export interface NounPluralTask {
  readonly kind: 'noun_plural';
  readonly word: string;
  readonly claimedPlural: string;
}
export interface RegularPastTenseTask {
  readonly kind: 'regular_past_tense';
  readonly verb: string;
  readonly claimedPast: string;
}
export interface ComparativeAdjectiveTask {
  readonly kind: 'comparative_adjective';
  readonly adjective: string;
  readonly claimedComparative: string;
}
export type EnglishTask = NounPluralTask | RegularPastTenseTask | ComparativeAdjectiveTask;

export interface EnglishCheckResult {
  readonly correct: boolean;
  readonly ran: boolean;
  readonly reason: MathCheckReason;
}

const WORD = /^[a-z]+$/i;

const result = (correct: boolean): EnglishCheckResult => ({
  correct,
  ran: true,
  reason: correct ? 'ANSWER_KEY_CORRECT' : 'ANSWER_KEY_WRONG',
});
const malformed: EnglishCheckResult = { correct: false, ran: false, reason: 'MALFORMED_TASK' };

/** Verify a rule-decidable English answer key (or grade a learner answer the same way). */
export function checkEnglishTask(task: EnglishTask): EnglishCheckResult {
  switch (task.kind) {
    case 'noun_plural':
      if (!WORD.test(task.word) || !WORD.test(task.claimedPlural)) return malformed;
      return result(pluralize(task.word) === task.claimedPlural.toLowerCase());
    case 'regular_past_tense':
      if (!WORD.test(task.verb) || !WORD.test(task.claimedPast)) return malformed;
      return result(pastTenseRegular(task.verb) === task.claimedPast.toLowerCase());
    case 'comparative_adjective':
      if (!WORD.test(task.adjective) || !WORD.test(task.claimedComparative)) return malformed;
      return result(comparativeRegular(task.adjective) === task.claimedComparative.toLowerCase());
    default: {
      const _never: never = task;
      void _never;
      return { correct: false, ran: false, reason: 'UNSUPPORTED_TASK' };
    }
  }
}
