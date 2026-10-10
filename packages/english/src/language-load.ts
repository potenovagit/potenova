import type { EnglishPolicy } from './policy';

/**
 * Language-load modelling (Product §4/§5; AT-14).
 *
 * Reading friction is modelled SEPARATELY from mathematical difficulty, so a
 * reading-heavy Math item never automatically downgrades Math mastery. When a
 * child misses a high-language-load Math item, the engine flags reading support
 * rather than crediting a Math weakness.
 */

export interface LanguageLoad {
  /** Approximate reading grade level the item demands. */
  readonly readingGradeLevel: number;
  /** 0..1 lexical density (proportion of content/low-frequency words). */
  readonly lexicalDensity: number;
}

export function isHighLanguageLoad(load: LanguageLoad, policy: EnglishPolicy): boolean {
  return load.lexicalDensity >= policy.highLanguageLoadThreshold;
}

export interface MathLanguageDecision {
  /** Invariant (AT-14): reading friction never auto-downgrades Math mastery. */
  readonly downgradeMath: boolean;
  readonly action: 'SCORE_NORMALLY' | 'FLAG_READING_SUPPORT';
}

/**
 * Decide how a Math attempt interacts with its language load.
 * - correct → scored normally (a correct answer always counts).
 * - incorrect + high language load → flag reading support, do NOT downgrade Math.
 * - incorrect + ordinary language load → scored normally (a genuine Math miss).
 */
export function mathUnderLanguageLoad(
  input: { readonly mathCorrect: boolean; readonly load: LanguageLoad },
  policy: EnglishPolicy,
): MathLanguageDecision {
  if (input.mathCorrect) return { downgradeMath: false, action: 'SCORE_NORMALLY' };
  if (isHighLanguageLoad(input.load, policy)) {
    return { downgradeMath: false, action: 'FLAG_READING_SUPPORT' };
  }
  return { downgradeMath: true, action: 'SCORE_NORMALLY' };
}
