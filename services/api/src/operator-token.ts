import { DomainError } from '@potenova/contracts';
import { isOperatorRole, type OperatorRole } from '@potenova/identity';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { SessionSigningConfig, IssuedSession } from './session-token';

/**
 * Operator session tokens (SEC-013/SEC-002). After the managed IdP verifies an
 * operator, Potenova mints its OWN short-lived, capability-scoped token carrying
 * exactly the claims the auth middleware reads: `actor_type: 'operator'`, the
 * operator alias, and the RBAC `operator_role` resolved from the persisted
 * operator directory — never from the caller. No family scope, no IdP PII.
 *
 * Operator privilege auto-expires: the token is deliberately shorter-lived than
 * a guardian session (OPERATOR_SESSION_TTL_SECONDS), a partial SEC-002 control
 * (standing privilege is time-boxed). Full just-in-time elevation and dual
 * authorization (SEC-003) are follow-on controls (ADR-0038).
 */

/** Operator sessions are short by design — privilege is time-boxed (SEC-002). */
export const OPERATOR_SESSION_TTL_SECONDS = 900;

/** A JIT elevation window is shorter still — the elevation auto-expires. */
export const OPERATOR_STEP_UP_TTL_SECONDS = 300;

export interface OperatorSessionInput {
  readonly operatorId: string;
  readonly role: OperatorRole;
  readonly region: string;
  /** An elevated (JIT-stepped-up) session, for sensitive operator actions. */
  readonly stepUp?: boolean;
  /** Override the TTL (seconds) — used to time-box an elevation window. */
  readonly ttlSecondsOverride?: number;
}

/**
 * Mint a short-lived operator session token. The role is carried as the
 * `operator_role` claim; `step_up` marks an elevated session. The TTL is capped
 * at OPERATOR_SESSION_TTL_SECONDS (and never longer than the configured session
 * TTL); an elevation passes a shorter override.
 */
export async function issueOperatorSession(
  input: OperatorSessionInput,
  cfg: SessionSigningConfig,
  nowMs: number = Date.now(),
): Promise<IssuedSession> {
  const iat = Math.floor(nowMs / 1000);
  const cap = Math.min(OPERATOR_SESSION_TTL_SECONDS, cfg.ttlSeconds);
  const ttl = Math.min(input.ttlSecondsOverride ?? cap, cap);
  const exp = iat + ttl;
  const key = new TextEncoder().encode(cfg.secret);
  const token = await new SignJWT({
    actor_type: 'operator',
    actor_alias: input.operatorId,
    operator_role: input.role,
    step_up: input.stepUp === true,
    processing_region: input.region,
    purpose: 'support',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(input.operatorId)
    .setIssuedAt(iat)
    .setIssuer(cfg.issuer)
    .setAudience(cfg.audience)
    .setExpirationTime(exp)
    .sign(key);
  return { token, expiresAt: new Date(exp * 1000).toISOString() };
}

export interface VerifiedOperatorSession {
  readonly operatorId: string;
  readonly role: OperatorRole;
  readonly region: string;
  readonly stepUp: boolean;
}

/**
 * Verify a Potenova operator session token and return its identity + role. Used
 * by the operator step-up endpoint to confirm the caller's current session
 * before elevating it. Fail-closed on any verification failure, a non-operator
 * token, or an unknown role.
 *
 * @throws DomainError AUTH_REQUIRED — invalid/expired token or not an operator.
 */
export async function verifyOperatorSession(
  token: string,
  cfg: SessionSigningConfig,
): Promise<VerifiedOperatorSession> {
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, new TextEncoder().encode(cfg.secret), {
      issuer: cfg.issuer,
      audience: cfg.audience,
    }));
  } catch {
    throw new DomainError('AUTH_REQUIRED', 'invalid or expired operator session token');
  }
  const operatorId = typeof payload.sub === 'string' ? payload.sub : '';
  const role = payload.operator_role;
  if (payload.actor_type !== 'operator' || !operatorId || !isOperatorRole(role)) {
    throw new DomainError('AUTH_REQUIRED', 'not an operator session');
  }
  return {
    operatorId,
    role,
    region:
      typeof payload.processing_region === 'string' ? payload.processing_region : 'ca-central',
    stepUp: payload.step_up === true,
  };
}
