/**
 * English engine policy (WP-09) — versioned, DRAFT parameters.
 *
 * ============================================================================
 *  LOCKED (Product §5; AI Learning §6): reading-aloud tracks observable signals
 *  only (no clinical/diagnostic claims); writing coaching never ghostwrites;
 *  language load is modelled separately from Math difficulty. The NUMERIC
 *  threshold below (what counts as "high language load") is a DRAFT placeholder —
 *  EVIDENCE REQUIRED from readability calibration before G2 — isolated behind a
 *  version string.
 * ============================================================================
 */

/** Observable oral-reading signals (never a diagnosis). */
export const READING_SIGNALS = [
  'substitution',
  'omission',
  'insertion',
  'self_correction',
  'pause',
  'repetition',
] as const;
export type ReadingSignal = (typeof READING_SIGNALS)[number];

/** Writing-coach rubric dimensions (Product §5; AI Learning §6). */
export const WRITING_RUBRIC = [
  'ideas',
  'organization',
  'vocabulary',
  'sentence_structure',
  'conventions',
  'audience_purpose',
  'revision',
  'independence',
] as const;
export type WritingDimension = (typeof WRITING_RUBRIC)[number];

export interface EnglishPolicy {
  readonly policyVersion: string;
  /** 0..1 lexical-density cutoff above which a passage is flagged high language load. */
  readonly highLanguageLoadThreshold: number;
}

export const DRAFT_ENGLISH_POLICY: EnglishPolicy = {
  policyVersion: 'english-DRAFT-0.1(readability-UNCALIBRATED)',
  highLanguageLoadThreshold: 0.7,
};
