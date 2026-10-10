import { DomainError } from '@potenova/contracts';
import { MIN_TRUSTED_RECOGNITION } from '@potenova/learner-state';

/**
 * Voice/caption path and uploaded-evidence confirmation (WP-08; AT-18/28).
 *
 * - Audio ALWAYS ships with captions (accessibility, no audio-only path).
 * - A low-confidence voice/OCR reading asks for clarification; it is never used
 *   for a confident grade change (AT-28) — shares the WP-03 trust floor.
 * - An uploaded report card is OCR-extracted as PROVISIONAL facts; nothing
 *   influences planning until a parent confirms it (AT-18).
 */

/** Audio output always requires captions — there is no audio-only turn. */
export function captionsRequiredForAudio(): true {
  return true;
}

export type VoiceTurnDecision = 'USE' | 'REQUEST_CLARIFICATION';

/** AT-28: below the trust floor, request clarification instead of grading. */
export function voiceTurnDecision(recognitionConfidence: number): VoiceTurnDecision {
  return recognitionConfidence >= MIN_TRUSTED_RECOGNITION ? 'USE' : 'REQUEST_CLARIFICATION';
}

export type FactStatus = 'provisional' | 'confirmed';

export interface ExtractedFact {
  readonly factId: string;
  readonly label: string;
  readonly value: string;
  /** OCR certainty 0..1 — surfaced to the parent as uncertainty. */
  readonly recognitionConfidence: number;
  readonly status: FactStatus;
  readonly confirmedBy: string | null;
}

/** AT-18: a parent explicitly confirms an extracted fact before it can affect planning. */
export function confirmFact(fact: ExtractedFact, parentGuardianId: string): ExtractedFact {
  if (!parentGuardianId) {
    throw new DomainError('AUTH_REQUIRED', 'a guardian must confirm an extracted fact');
  }
  return { ...fact, status: 'confirmed', confirmedBy: parentGuardianId };
}

/** Only parent-confirmed facts may influence the learning plan (AT-18). */
export function factsUsableForPlanning(facts: readonly ExtractedFact[]): ExtractedFact[] {
  return facts.filter((f) => f.status === 'confirmed');
}
