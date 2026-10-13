import type { SafetySeverity } from './policy';

/**
 * Safety escalation matrix (ER-08 — EVIDENCE REQUIRED, owner Child Safety/Legal).
 *
 * The matrix maps a sensitive disclosure — category × severity × confidence ×
 * whether a household member is implicated — to a decision: the response pattern
 * (SAFE-009), whether to route to restricted human review (SAFE-007), and the
 * parent-notification behaviour (SAFE-006). The CELL VALUES are the child-safety
 * expert's to set; this module is the mechanism, built now and valued later
 * (`escalationMatrixFrom(...)`).
 *
 * Fail-closed by construction:
 *  - an unconfigured (or, under requireApproved, unsigned) cell → MAX CONTAINMENT;
 *  - the safety validator being unavailable → MAX CONTAINMENT (SAFE-010);
 *  - hard invariants OVERRIDE any cell so a mis-set matrix can never weaken safety:
 *      · household implicated → suppress automatic parent alert + human review (SAFE-006/AT-23);
 *      · critical severity → constrained response + human review;
 *      · high severity → human review ("as risk increases, AI freedom decreases").
 *
 * This is entered only for a SENSITIVE disclosure (SAFE-016); ordinary off-topic
 * chatter is redirected upstream and never reaches the matrix. Reason codes only,
 * never raw child content.
 */

/** Proposed category set — the expert confirms/adjusts the taxonomy at ER-08. */
export const DISCLOSURE_CATEGORIES = [
  'self_harm',
  'maltreatment_or_unsafe_home',
  'immediate_danger',
  'peer_harm',
  'general_distress',
] as const;
export type DisclosureCategory = (typeof DISCLOSURE_CATEGORIES)[number];

export type ConfidenceBand = 'low' | 'medium' | 'high';

/** SAFE-009: constrained patterns for safety-critical; standard_safe for lower-risk. */
export type ResponsePattern = 'constrained' | 'standard_safe';
export type ParentNotification = 'suppressed' | 'deferred' | 'standard';

export interface EscalationRule {
  readonly humanReview: boolean;
  readonly parentNotify: ParentNotification;
  readonly responsePattern: ResponsePattern;
}

export interface EscalationInput {
  readonly category: DisclosureCategory;
  readonly severity: SafetySeverity;
  readonly confidence: ConfidenceBand;
  readonly householdImplicated: boolean;
}

export interface EscalationOutcome {
  readonly humanReview: boolean;
  readonly parentNotification: ParentNotification;
  readonly responsePattern: ResponsePattern;
  /** false → the matrix cell was pending/unsigned and max containment was applied. */
  readonly configured: boolean;
  readonly reasonCodes: readonly string[];
}

/** The fail-closed floor: fullest containment. */
const MAX_CONTAINMENT: EscalationRule = {
  humanReview: true,
  parentNotify: 'suppressed',
  responsePattern: 'constrained',
};

export interface EscalationMatrix {
  readonly decisionId: string;
  readonly approved: boolean;
  readonly rules: Readonly<Record<string, EscalationRule>>;
}

function cellKey(i: EscalationInput): string {
  return `${i.category}|${i.severity}|${i.confidence}|${i.householdImplicated ? 'hh' : 'no'}`;
}

/** The starting state — no cells set; every input fails closed to max containment. */
export function emptyEscalationMatrix(decisionId = 'ER-08'): EscalationMatrix {
  return { decisionId, approved: false, rules: {} };
}

export interface EscalationCell {
  readonly input: EscalationInput;
  readonly rule: EscalationRule;
}

/** Build a matrix from the expert's cells. `approved` stays false until signed. */
export function escalationMatrixFrom(
  cells: readonly EscalationCell[],
  opts: { approved?: boolean; decisionId?: string } = {},
): EscalationMatrix {
  const rules: Record<string, EscalationRule> = {};
  for (const c of cells) rules[cellKey(c.input)] = c.rule;
  return { decisionId: opts.decisionId ?? 'ER-08', approved: opts.approved ?? false, rules };
}

function finalize(
  base: EscalationRule,
  configured: boolean,
  input: EscalationInput,
  reason: Set<string>,
): EscalationOutcome {
  let humanReview = base.humanReview;
  let parentNotification = base.parentNotify;
  let responsePattern = base.responsePattern;

  // Hard invariants — override any configured cell.
  if (input.householdImplicated) {
    parentNotification = 'suppressed';
    humanReview = true;
    reason.add('HOUSEHOLD_SUPPRESS_PARENT');
  }
  if (input.severity === 'critical') {
    humanReview = true;
    responsePattern = 'constrained';
    reason.add('CRITICAL_FLOOR');
  } else if (input.severity === 'high') {
    humanReview = true;
    reason.add('HIGH_SEVERITY_FLOOR');
  }

  return {
    humanReview,
    parentNotification,
    responsePattern,
    configured,
    reasonCodes: [...reason],
  };
}

/**
 * Decide escalation for a sensitive disclosure. Fail-closed on unavailability,
 * pending/unsigned cells, and via the hard invariants in `finalize`.
 */
export function decideEscalation(
  matrix: EscalationMatrix,
  input: EscalationInput,
  opts: { available?: boolean; requireApproved?: boolean } = {},
): EscalationOutcome {
  const reason = new Set<string>();

  // SAFE-010: safety validator outage → fail closed, before anything else.
  if (opts.available === false) {
    reason.add('VALIDATOR_UNAVAILABLE');
    reason.add('FAIL_CLOSED_MAX_CONTAINMENT');
    return finalize(MAX_CONTAINMENT, false, input, reason);
  }

  const cell = matrix.rules[cellKey(input)];
  const usable = cell !== undefined && (!opts.requireApproved || matrix.approved);

  if (usable) {
    reason.add('MATRIX_RULE');
    return finalize(cell, true, input, reason);
  }
  reason.add(
    cell !== undefined && !matrix.approved
      ? 'MATRIX_UNAPPROVED_MAX_CONTAINMENT'
      : 'UNCONFIGURED_MAX_CONTAINMENT',
  );
  return finalize(MAX_CONTAINMENT, false, input, reason);
}
