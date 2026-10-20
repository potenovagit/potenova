import type { OperatorRole } from '@potenova/identity';
import { SignJWT } from 'jose';
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

export interface OperatorSessionInput {
  readonly operatorId: string;
  readonly role: OperatorRole;
  readonly region: string;
}

/**
 * Mint a short-lived operator session token. The role is carried as the
 * `operator_role` claim and is capped at OPERATOR_SESSION_TTL_SECONDS (never
 * longer than the configured session TTL).
 */
export async function issueOperatorSession(
  input: OperatorSessionInput,
  cfg: SessionSigningConfig,
  nowMs: number = Date.now(),
): Promise<IssuedSession> {
  const iat = Math.floor(nowMs / 1000);
  const ttl = Math.min(OPERATOR_SESSION_TTL_SECONDS, cfg.ttlSeconds);
  const exp = iat + ttl;
  const key = new TextEncoder().encode(cfg.secret);
  const token = await new SignJWT({
    actor_type: 'operator',
    actor_alias: input.operatorId,
    operator_role: input.role,
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
