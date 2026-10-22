/**
 * Mastery evidence event (WP-03).
 * Source: 05_AI_Learning_Evaluation.md §1; LRN-001/002/003; canonical EvidenceEvent.
 *
 * This is the rich, append-only observation the projection engine consumes. It
 * extends the minimal domain-core ledger event with the dimensions mastery
 * projection needs: mode, correctness, representation, timing and curriculum
 * edition. Every assessed intervention distinguishes independent from guided
 * performance (assistance band), and nothing here encodes an unsupported
 * diagnosis.
 */

/** Interaction mode — governs how an observation may count toward mastery. */
export const EVIDENCE_MODES = [
  'diagnostic',
  'teaching',
  'independent_check',
  'retention_check',
  'transfer_check',
] as const;
export type EvidenceMode = (typeof EVIDENCE_MODES)[number];

/** Assistance bands A0..A5 (05 §1). A4/A5 cannot by themselves verify unaided mastery. */
export const ASSISTANCE_BANDS = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'] as const;
export type AssistanceBand = (typeof ASSISTANCE_BANDS)[number];

export interface MasteryEvidence {
  readonly eventId: string;
  readonly learnerAlias: string;
  readonly skillId: string;
  readonly mode: EvidenceMode;
  readonly assistanceBand: AssistanceBand;
  readonly correct: boolean;
  /** Representation used (e.g. 'area-model', 'number-line', 'symbolic', 'set'). */
  readonly representation: string;
  /** Transcription/recognition certainty 0..1 (voice/vision); low → not trusted. */
  readonly recognitionConfidence: number;
  /** When the learner produced the evidence (ISO 8601) — used for delayed retrieval. */
  readonly observedAt: string;
  readonly curriculumReleaseId: string;
  readonly schemaVersion: string;
  /** Conceptual-assessment fields (ER-03). Present only on conceptual probe
   *  responses; the representation-based projection ignores them, and the
   *  conceptual projection consumes only events that carry them. Optional and
   *  non-breaking for existing evidence. */
  readonly evidenceDimension?: 'model' | 'value' | 'reasoning' | 'transfer';
  /** Canonical item-family id — distinct families prevent double-counting a template. */
  readonly itemFamilyId?: string;
  /** The grade this item asserts — the assessed-core grade gate filters on it. */
  readonly gradeTarget?: number;
  /** Explicit assessment-session id (else a session is derived as the UTC day). */
  readonly sessionId?: string;
}

/** A correction linked to a prior event — appended, never a rewrite (LRN-003). */
export interface EvidenceCorrectionRecord {
  readonly correctionId: string;
  readonly targetEventId: string;
  readonly reason: string;
  /** If true, the target observation is retracted from projection (e.g. disputed marking, AT-25). */
  readonly retract: boolean;
  readonly createdAt: string;
}

/** Minimum recognition confidence below which an observation is not trusted for grading (AT-28). */
export const MIN_TRUSTED_RECOGNITION = 0.75;
