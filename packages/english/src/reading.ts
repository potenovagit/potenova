import { DomainError } from '@potenova/contracts';
import { MIN_TRUSTED_RECOGNITION } from '@potenova/learner-state';
import type { ReadingSignal } from './policy';

/**
 * Read-aloud oral-reading analysis (Product §5; AI Learning §6; AT-15).
 *
 * Captures OBSERVABLE signals only — substitutions, omissions, self-corrections,
 * pauses — plus a separate comprehension result. It never infers a clinical or
 * diagnostic label. Decoding and comprehension are independent dimensions:
 *  - When the passage is read aloud TO the child (TTS-assisted), decoding is NOT
 *    credited as independent, but comprehension evidence still counts (AT-15).
 *  - A low-confidence speech-recognition reading is not trusted for grading.
 */

export interface OralReadingObservation {
  readonly learnerAlias: string;
  readonly passageId: string;
  readonly signals: Readonly<Record<ReadingSignal, number>>;
  readonly comprehensionCorrect: boolean;
  /** Speech-recognition certainty 0..1. */
  readonly recognitionConfidence: number;
  /** True when the passage was read aloud to the child (TTS), not decoded by them. */
  readonly ttsAssisted: boolean;
}

export interface ReadingEvidenceAttribution {
  /** Independent decoding evidence — excluded under TTS or low recognition (AT-15). */
  readonly decodingAdmissible: boolean;
  /** Comprehension counts regardless of TTS assistance (AT-15). */
  readonly comprehensionAdmissible: boolean;
  /** Fluency reflects the child's own reading — not meaningful under TTS. */
  readonly fluencyAdmissible: boolean;
}

export function attributeReadingEvidence(obs: OralReadingObservation): ReadingEvidenceAttribution {
  const recognized = obs.recognitionConfidence >= MIN_TRUSTED_RECOGNITION;
  return {
    decodingAdmissible: !obs.ttsAssisted && recognized,
    comprehensionAdmissible: true,
    fluencyAdmissible: !obs.ttsAssisted && recognized,
  };
}

export type ReadingOutputKind = 'observation' | 'diagnosis';

/**
 * Guard: the engine may emit observations, never a clinical/diagnostic label
 * (Product §5 "without unsupported clinical/diagnostic claims").
 *
 * @throws DomainError POLICY_BLOCKED — an attempt to emit a diagnosis.
 */
export function assertNoClinicalLabel(kind: ReadingOutputKind): void {
  if (kind === 'diagnosis') {
    throw new DomainError('POLICY_BLOCKED', 'reading analysis must not infer a clinical diagnosis');
  }
}
