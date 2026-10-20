import {
  type ActorContext,
  type ActorType,
  type Purpose,
  ACTOR_TYPES,
  DomainError,
  isApprovedRegion,
} from '@potenova/contracts';
import {
  type OperatorRole,
  type OperatorPermission,
  assertOperatorPermission,
  isOperatorRole,
} from '@potenova/identity';
import type { Context, MiddlewareHandler } from 'hono';
import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';

/**
 * Authentication (ADR-0008). Two modes, chosen by AUTH_MODE:
 *
 *  - 'dev'  — identity comes from request headers. Trivially spoofable; only for
 *             local use and synthetic-data staging, never prod.
 *  - 'jwt'  — identity comes from a cryptographically verified bearer token
 *             (HS256 shared secret, or RS256 via a JWKS URL for a real IdP).
 *             Signature, expiry, issuer and audience are all checked; the
 *             ActorContext is built only from verified claims.
 *
 * Either way the authorization rules it feeds (actor-type gates, guardian role,
 * residency, consent, mastery-producer-only) are the real domain guards. A
 * middleware resolves the AuthCtx once per request and stashes it; routes read
 * it synchronously via readAuth.
 */
export interface AuthCtx {
  readonly actor: ActorContext;
  readonly guardianRole?: 'owner' | 'learning_viewer';
  /** The operator's RBAC role, when the actor is an operator (SEC-013). */
  readonly operatorRole?: OperatorRole;
  readonly stepUp: boolean;
  readonly region: string;
}

export interface JwtAuthConfig {
  readonly issuer: string;
  readonly audience: string;
  /** HS256 shared secret (dev/test); mutually exclusive with jwksUrl. */
  readonly secret?: string;
  /** RS256 JWKS endpoint of the IdP (prod); mutually exclusive with secret. */
  readonly jwksUrl?: string;
}
export type AuthConfig =
  | { readonly mode: 'dev' }
  | { readonly mode: 'jwt'; readonly jwt: JwtAuthConfig };

/** Read auth configuration from the environment, fail-closed in jwt mode. */
export function readAuthConfig(env: NodeJS.ProcessEnv): AuthConfig {
  const mode = env.AUTH_MODE ?? 'dev';
  if (mode === 'dev') return { mode: 'dev' };
  if (mode !== 'jwt') throw new DomainError('POLICY_BLOCKED', `invalid AUTH_MODE: ${mode}`);
  const issuer = env.AUTH_JWT_ISSUER;
  const audience = env.AUTH_JWT_AUDIENCE;
  if (!issuer || !audience)
    throw new DomainError(
      'POLICY_BLOCKED',
      'AUTH_JWT_ISSUER and AUTH_JWT_AUDIENCE are required in jwt mode',
    );
  const secret = env.AUTH_JWT_SECRET;
  const jwksUrl = env.AUTH_JWKS_URL;
  if (!secret && !jwksUrl)
    throw new DomainError('POLICY_BLOCKED', 'jwt mode needs AUTH_JWT_SECRET or AUTH_JWKS_URL');
  return { mode: 'jwt', jwt: { issuer, audience, secret, jwksUrl } };
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function jwksFor(url: string) {
  let set = jwksCache.get(url);
  if (!set) {
    set = createRemoteJWKSet(new URL(url));
    jwksCache.set(url, set);
  }
  return set;
}

async function verifyToken(token: string, cfg: JwtAuthConfig): Promise<JWTPayload> {
  const options = { issuer: cfg.issuer, audience: cfg.audience };
  if (cfg.jwksUrl) {
    const { payload } = await jwtVerify(token, jwksFor(cfg.jwksUrl), options);
    return payload;
  }
  const key = new TextEncoder().encode(cfg.secret);
  const { payload } = await jwtVerify(token, key, options);
  return payload;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/** Build the AuthCtx from verified JWT claims. Unknown/missing actor type fails closed. */
function fromClaims(p: JWTPayload, defaultRegion: string): AuthCtx {
  const actorType = str(p.actor_type);
  const actorAlias = str(p.actor_alias) ?? str(p.sub);
  if (!actorType || !(ACTOR_TYPES as readonly string[]).includes(actorType) || !actorAlias)
    throw new DomainError('AUTH_REQUIRED', 'token missing a valid actor identity');
  const gr = str(p.guardian_role);
  const or = str(p.operator_role);
  const actor: ActorContext = {
    actorType: actorType as ActorType,
    actorAlias,
    familyAlias: str(p.family_alias) ?? null,
    learnerAlias: str(p.learner_alias),
    purpose: (str(p.purpose) as Purpose | undefined) ?? 'support',
  };
  return {
    actor,
    guardianRole: gr === 'owner' || gr === 'learning_viewer' ? gr : undefined,
    operatorRole: isOperatorRole(or) ? or : undefined,
    stepUp: p.step_up === true || p.step_up === 'true',
    region: str(p.processing_region) ?? defaultRegion,
  };
}

/** Build the AuthCtx from request headers (dev mode). */
function fromHeaders(c: Context, defaultRegion: string): AuthCtx {
  const actorType = c.req.header('x-actor-type') as ActorType | undefined;
  const actorAlias = c.req.header('x-actor-alias');
  if (!actorType || !actorAlias)
    throw new DomainError('AUTH_REQUIRED', 'x-actor-type and x-actor-alias are required');
  const gr = c.req.header('x-guardian-role');
  const or = c.req.header('x-operator-role');
  const actor: ActorContext = {
    actorType,
    actorAlias,
    familyAlias: c.req.header('x-family-alias') ?? null,
    learnerAlias: c.req.header('x-learner-alias') ?? undefined,
    purpose: (c.req.header('x-purpose') as Purpose | undefined) ?? 'support',
  };
  return {
    actor,
    guardianRole: gr === 'owner' || gr === 'learning_viewer' ? gr : undefined,
    operatorRole: isOperatorRole(or) ? or : undefined,
    stepUp: c.req.header('x-step-up') === 'true',
    region: c.req.header('x-processing-region') ?? defaultRegion,
  };
}

/** Paths that carry the API (everything else — UI, health — is public). */
const API_PREFIXES = ['/families', '/learners', '/billing', '/diagnostic', '/content', '/operator'];
function isApiPath(path: string): boolean {
  return API_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Resolve the AuthCtx once per request for API paths and stash it on the context.
 * Non-API paths (the web UI, health checks) pass through unauthenticated.
 */
export function authMiddleware(cfg: AuthConfig, defaultRegion: string): MiddlewareHandler {
  return async (c, next) => {
    if (!isApiPath(c.req.path)) {
      await next();
      return;
    }
    let auth: AuthCtx;
    if (cfg.mode === 'jwt') {
      const header = c.req.header('authorization') ?? '';
      const match = /^Bearer\s+(.+)$/i.exec(header);
      if (!match) throw new DomainError('AUTH_REQUIRED', 'bearer token required');
      let payload: JWTPayload;
      try {
        payload = await verifyToken(match[1], cfg.jwt);
      } catch {
        throw new DomainError('AUTH_REQUIRED', 'invalid or expired token');
      }
      auth = fromClaims(payload, defaultRegion);
    } else {
      auth = fromHeaders(c, defaultRegion);
    }
    (c.set as (k: string, v: AuthCtx) => void)('auth', auth);
    await next();
  };
}

/** Read the request's resolved AuthCtx (set by authMiddleware). */
export function readAuth(c: Context, defaultRegion?: string): AuthCtx {
  const stored = (c.get as (k: string) => AuthCtx | undefined)('auth');
  if (stored) return stored;
  // Defensive fallback (e.g. a route not behind the middleware): header-derived.
  return fromHeaders(c, defaultRegion ?? 'ca-central');
}

/** Restrict a route to specific actor types (fail-closed). */
export function requireActorType(a: AuthCtx, ...types: readonly ActorType[]): void {
  if (!types.includes(a.actor.actorType)) {
    throw new DomainError('FORBIDDEN_ROLE', `requires actor type: ${types.join(' | ')}`);
  }
}

/**
 * Least-privilege operator gate (SEC-013 + SEC-002). Fail-closed: the actor must
 * be an `operator` whose RBAC role grants `permission`, AND — for a sensitive
 * permission — the session must be currently elevated (a time-bound JIT
 * step-up). A read-only operator can never reach an account-admin route, and even
 * an admin cannot mutate on a standing session until it elevates
 * (POST /auth/operator/step-up, or the `x-step-up` dev shim).
 */
export function requireOperatorPermission(a: AuthCtx, permission: OperatorPermission): void {
  assertOperatorPermission({
    actor: a.actor,
    operatorRole: a.operatorRole,
    permission,
    elevated: a.stepUp,
  });
}

/**
 * Step-up gate (ADR-0008, AT-24/52): a sensitive guardian action — billing,
 * data export, deletion, guardian grants — requires recently re-verified
 * (stepped-up) auth. Fail-closed: a session that has not stepped up is refused
 * with STEP_UP_REQUIRED so the client can re-verify (POST /auth/step-up). In
 * jwt mode `stepUp` comes only from a verified, step-up token; the dev header
 * shim honours `x-step-up` (dev is not a security boundary either way).
 */
export function requireStepUp(a: AuthCtx): void {
  if (!a.stepUp) {
    throw new DomainError('STEP_UP_REQUIRED', 'this action requires step-up re-verification');
  }
}

/** Canadian residency gate for any child-data / AI processing (NFR-02, AT-55). */
export function assertRegion(a: AuthCtx): void {
  if (!isApprovedRegion(a.region)) {
    throw new DomainError(
      'REGION_DISALLOWED',
      'processing region is outside the Canadian allowlist',
    );
  }
}
