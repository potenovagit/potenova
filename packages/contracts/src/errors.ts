/**
 * Canonical error taxonomy.
 * Source: 04_Logical_Contracts_Events_Sequences.md — "Error taxonomy".
 *
 * Invariant: "Sensitive details must not leak through error differences."
 * Callers return a DomainError code; they MUST NOT embed child content or
 * reveal whether a sibling/other-family resource exists.
 */
export const ERROR_CODES = [
  'AUTH_REQUIRED',
  'FORBIDDEN_ROLE',
  'CONSENT_REQUIRED',
  'ENTITLEMENT_INACTIVE',
  'REGION_DISALLOWED',
  'POLICY_BLOCKED',
  'SAFETY_BLOCKED',
  'VALIDATION_UNAVAILABLE',
  'LOW_EVIDENCE_CONFIDENCE',
  'STALE_VERSION',
  'CONFLICT',
  'NOT_FOUND',
  'RATE_LIMITED',
  'DEPENDENCY_UNAVAILABLE',
  'REVIEW_REQUIRED',
  'STEP_UP_REQUIRED',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class DomainError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message?: string) {
    // Message is for operators/logs only. It must never carry child content.
    super(message ?? code);
    this.name = 'DomainError';
    this.code = code;
  }
}

export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}
