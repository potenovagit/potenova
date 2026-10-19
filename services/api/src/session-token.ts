import { DomainError } from '@potenova/contracts';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

/**
 * Potenova session tokens (ADR-0008: "server-authoritative sessions with
 * short-lived, capability-scoped tokens").
 *
 * After the managed IdP (Entra External ID) verifies a guardian, Potenova issues
 * its OWN short-lived token carrying only the capability claims the app's auth
 * middleware reads (actor type, guardian role, family scope, region). The IdP
 * credential is never reused as the app session.
 *
 * The token is an HS256 JWT signed with the same issuer/audience/secret the
 * `jwt`-mode auth middleware verifies, so an issued session authenticates
 * downstream requests with no extra wiring. Children are NEVER issued one — they
 * use the device-bound `ChildSessionCredential` — so this only ever mints
 * guardian sessions.
 */

export interface SessionSigningConfig {
  readonly issuer: string;
  readonly audience: string;
  readonly secret: string;
  readonly ttlSeconds: number;
}

/** Non-prod signing fallback — clearly insecure and dev-only, like dev.ts. */
const DEV_SESSION_SECRET = 'dev-insecure-session-secret-change-me';

/**
 * Read the session signing config from the environment. Reuses the AUTH_JWT_*
 * values so the token is verifiable by `jwt`-mode auth. Fail-closed: in prod a
 * real secret is required; a non-prod run falls back to a dev secret.
 *
 * @throws DomainError POLICY_BLOCKED — prod without an AUTH_JWT_SECRET.
 */
export function readSessionConfig(env: NodeJS.ProcessEnv, isProd: boolean): SessionSigningConfig {
  const issuer = env.AUTH_JWT_ISSUER ?? 'potenova-idp';
  const audience = env.AUTH_JWT_AUDIENCE ?? 'potenova-api';
  const ttlSeconds = Number(env.SESSION_TTL_SECONDS ?? 3600);
  const secret = env.AUTH_JWT_SECRET ?? (isProd ? undefined : DEV_SESSION_SECRET);
  if (!secret) {
    throw new DomainError(
      'POLICY_BLOCKED',
      'session signing requires AUTH_JWT_SECRET in production',
    );
  }
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > 86_400) {
    throw new DomainError('POLICY_BLOCKED', 'SESSION_TTL_SECONDS must be within (0, 86400]');
  }
  return { issuer, audience, secret, ttlSeconds };
}

export interface GuardianSessionInput {
  readonly guardianId: string;
  readonly familyId: string;
  readonly region: string;
  /** A stepped-up (re-verified) session, for sensitive actions. Default false. */
  readonly stepUp?: boolean;
  /** Override the TTL (seconds) — used to time-box an elevated step-up window. */
  readonly ttlSecondsOverride?: number;
}

export interface IssuedSession {
  readonly token: string;
  readonly expiresAt: string;
}

/** A step-up window is short by design — the elevation is time-boxed. */
export const STEP_UP_TTL_SECONDS = 300;

/**
 * Mint a short-lived guardian session token. The claims are exactly what the
 * auth middleware builds its ActorContext from — guardian actor type, owner role,
 * family scope, processing region, and whether step-up re-verification is
 * satisfied (false unless this is an elevated token). No email or other IdP PII
 * is embedded.
 */
export async function issueGuardianSession(
  input: GuardianSessionInput,
  cfg: SessionSigningConfig,
  nowMs: number = Date.now(),
): Promise<IssuedSession> {
  const iat = Math.floor(nowMs / 1000);
  const ttl = Math.min(input.ttlSecondsOverride ?? cfg.ttlSeconds, cfg.ttlSeconds);
  const exp = iat + ttl;
  const key = new TextEncoder().encode(cfg.secret);
  const token = await new SignJWT({
    actor_type: 'guardian',
    actor_alias: input.guardianId,
    family_alias: input.familyId,
    guardian_role: 'owner',
    step_up: input.stepUp === true,
    processing_region: input.region,
    purpose: 'support',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(input.guardianId)
    .setIssuedAt(iat)
    .setIssuer(cfg.issuer)
    .setAudience(cfg.audience)
    .setExpirationTime(exp)
    .sign(key);
  return { token, expiresAt: new Date(exp * 1000).toISOString() };
}

export interface VerifiedGuardianSession {
  readonly guardianId: string;
  readonly familyId: string | null;
  readonly region: string;
  readonly stepUp: boolean;
}

/**
 * Verify a Potenova session token (the one `issueGuardianSession` mints) and
 * return its guardian identity. Used by the step-up endpoint to confirm the
 * caller's current session before elevating it. Fail-closed on any verification
 * failure or a non-guardian token.
 *
 * @throws DomainError AUTH_REQUIRED — invalid/expired token or not a guardian.
 */
export async function verifyGuardianSession(
  token: string,
  cfg: SessionSigningConfig,
): Promise<VerifiedGuardianSession> {
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, new TextEncoder().encode(cfg.secret), {
      issuer: cfg.issuer,
      audience: cfg.audience,
    }));
  } catch {
    throw new DomainError('AUTH_REQUIRED', 'invalid or expired session token');
  }
  const guardianId = typeof payload.sub === 'string' ? payload.sub : '';
  if (payload.actor_type !== 'guardian' || !guardianId) {
    throw new DomainError('AUTH_REQUIRED', 'not a guardian session');
  }
  return {
    guardianId,
    familyId: typeof payload.family_alias === 'string' ? payload.family_alias : null,
    region: typeof payload.processing_region === 'string' ? payload.processing_region : 'ca-central',
    stepUp: payload.step_up === true,
  };
}
