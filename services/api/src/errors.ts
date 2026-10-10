import { isDomainError, type ErrorCode } from '@potenova/contracts';
import type { Context } from 'hono';

/** Map each domain error code to an HTTP status (fail-closed, no content leak). */
const STATUS: Record<ErrorCode, number> = {
  AUTH_REQUIRED: 401,
  FORBIDDEN_ROLE: 403,
  CONSENT_REQUIRED: 403,
  ENTITLEMENT_INACTIVE: 402,
  REGION_DISALLOWED: 451,
  POLICY_BLOCKED: 422,
  SAFETY_BLOCKED: 403,
  VALIDATION_UNAVAILABLE: 503,
  LOW_EVIDENCE_CONFIDENCE: 422,
  STALE_VERSION: 409,
  CONFLICT: 409,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  DEPENDENCY_UNAVAILABLE: 503,
  REVIEW_REQUIRED: 403,
};

export function statusForCode(code: ErrorCode): number {
  return STATUS[code] ?? 400;
}

/** Hono error hook: a thrown DomainError becomes {code,message} + its status. */
export function onError(err: unknown, c: Context): Response {
  if (isDomainError(err)) {
    return c.json({ code: err.code, message: err.message }, statusForCode(err.code) as 400);
  }
  return c.json({ code: 'INTERNAL', message: 'internal error' }, 500);
}
