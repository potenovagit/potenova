import { DomainError } from '@potenova/contracts';
import type { SafetySeverity } from './policy';

/**
 * SafetyCase lifecycle (Architecture §3.8; SAFE-002/006/007/008).
 *
 *   DETECTED -> TRIAGED -> AUTOMATED_SAFE_RESPONSE | RESTRICTED_REVIEW
 *            -> [ACTIONED | FALSE_POSITIVE] -> CLOSED
 *
 * - Triage routes by severity/ambiguity: low/elevated → an approved automated
 *   safe response; high/critical/ambiguous → restricted human review under least
 *   privilege (SAFE-007). No routine staff access to child conversations.
 * - A safety record captures the OBSERVED risk signal only — never a clinical or
 *   emotional/medical diagnosis (SAFE-008).
 */

export const SAFETY_CASE_STATES = [
  'DETECTED',
  'TRIAGED',
  'AUTOMATED_SAFE_RESPONSE',
  'RESTRICTED_REVIEW',
  'ACTIONED',
  'FALSE_POSITIVE',
  'CLOSED',
] as const;
export type SafetyCaseState = (typeof SAFETY_CASE_STATES)[number];

export interface SafetyCase {
  readonly caseId: string;
  readonly severity: SafetySeverity;
  readonly ambiguous: boolean;
  readonly state: SafetyCaseState;
}

const TRANSITIONS: Readonly<Record<SafetyCaseState, readonly SafetyCaseState[]>> = {
  DETECTED: ['TRIAGED'],
  TRIAGED: ['AUTOMATED_SAFE_RESPONSE', 'RESTRICTED_REVIEW'],
  AUTOMATED_SAFE_RESPONSE: ['ACTIONED', 'FALSE_POSITIVE'],
  RESTRICTED_REVIEW: ['ACTIONED', 'FALSE_POSITIVE'],
  ACTIONED: ['CLOSED'],
  FALSE_POSITIVE: ['CLOSED'],
  CLOSED: [],
};

export function detectCase(
  caseId: string,
  severity: SafetySeverity,
  ambiguous = false,
): SafetyCase {
  return { caseId, severity, ambiguous, state: 'DETECTED' };
}

function move(c: SafetyCase, to: SafetyCaseState): SafetyCase {
  if (!TRANSITIONS[c.state].includes(to)) {
    throw new DomainError('POLICY_BLOCKED', `illegal safety-case transition ${c.state} -> ${to}`);
  }
  return { ...c, state: to };
}

/** Triage a detected case to the tier its severity/ambiguity requires (SAFE-002/007). */
export function triage(c: SafetyCase): SafetyCase {
  const triaged = move(c, 'TRIAGED');
  const needsHuman = c.ambiguous || c.severity === 'high' || c.severity === 'critical';
  return move(triaged, needsHuman ? 'RESTRICTED_REVIEW' : 'AUTOMATED_SAFE_RESPONSE');
}

export function resolveCase(c: SafetyCase, outcome: 'ACTIONED' | 'FALSE_POSITIVE'): SafetyCase {
  return move(c, outcome);
}

export function closeCase(c: SafetyCase): SafetyCase {
  return move(c, 'CLOSED');
}

export type SafetyRecordKind = 'observed_risk_signal' | 'clinical_conclusion';

/**
 * SAFE-008: a safety record states an observed risk signal; it must never carry a
 * clinical/medical/emotional diagnosis.
 *
 * @throws DomainError POLICY_BLOCKED — an attempt to record a clinical conclusion.
 */
export function assertNoClinicalConclusion(kind: SafetyRecordKind): void {
  if (kind === 'clinical_conclusion') {
    throw new DomainError('POLICY_BLOCKED', 'a safety record must not carry a clinical conclusion');
  }
}
