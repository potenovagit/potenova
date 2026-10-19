import type { Hono } from 'hono';
import { DomainError } from '@potenova/contracts';
import { guardianRefForSubject } from '@potenova/identity';
import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';
import { now, type Deps } from '../deps';
import {
  issueGuardianSession,
  readSessionConfig,
  verifyGuardianSession,
  STEP_UP_TTL_SECONDS,
} from '../session-token';

/**
 * Guardian sign-in exchange (ADR-0008). The managed IdP (Entra External ID)
 * authenticates a guardian and issues a verified identity; this endpoint turns
 * that into a Potenova capability-scoped session token, provisioning the
 * guardian's family/guardian records on first sign-in.
 *
 * Two inbound modes:
 *  - Entra-token (production shape): `Authorization: Bearer <Entra OIDC token>`,
 *    verified against the configured Entra issuer/audience (JWKS in prod, a
 *    shared secret in tests). The verified `sub` is the guardian subject.
 *  - Synthetic (dev/staging only): a posted `{ idpSubject }` stands in for a
 *    verified identity so the flow is demonstrable without a real tenant. This
 *    path is FAIL-CLOSED in production — a real token is then required.
 *
 * Guardians only: this endpoint never issues a child or other-actor session.
 * `/auth/*` is not an authenticated API prefix, so it runs pre-auth and does its
 * own verification — it is the login endpoint.
 */

interface EntraVerifier {
  readonly issuer: string;
  readonly audience: string;
  readonly secret?: string;
  readonly jwksUrl?: string;
}

/** Read the Entra token verifier from the environment, or null if unconfigured. */
function readEntraVerifier(env: NodeJS.ProcessEnv): EntraVerifier | null {
  const issuer = env.ENTRA_ISSUER;
  const audience = env.ENTRA_AUDIENCE;
  if (!issuer || !audience) return null;
  const secret = env.ENTRA_SECRET;
  const jwksUrl = env.ENTRA_JWKS_URL;
  if (!secret && !jwksUrl) return null;
  return { issuer, audience, secret, jwksUrl };
}

const jwks = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function jwksFor(url: string) {
  let s = jwks.get(url);
  if (!s) {
    s = createRemoteJWKSet(new URL(url));
    jwks.set(url, s);
  }
  return s;
}

async function verifyEntraIdentity(token: string, v: EntraVerifier): Promise<string> {
  const options = { issuer: v.issuer, audience: v.audience };
  let payload: JWTPayload;
  try {
    payload = v.jwksUrl
      ? (await jwtVerify(token, jwksFor(v.jwksUrl), options)).payload
      : (await jwtVerify(token, new TextEncoder().encode(v.secret), options)).payload;
  } catch {
    throw new DomainError('AUTH_REQUIRED', 'invalid or expired identity token');
  }
  const sub = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  if (!sub) throw new DomainError('AUTH_REQUIRED', 'identity token has no subject');
  return sub;
}

export function registerAuth(app: Hono, deps: Deps, env: NodeJS.ProcessEnv): void {
  const isProd = deps.config.environment === 'prod';

  app.post('/auth/session', async (c) => {
    const bearer = /^Bearer\s+(.+)$/i.exec(c.req.header('authorization') ?? '')?.[1];

    // Resolve the verified guardian subject from whichever mode applies.
    let subject: string;
    if (bearer) {
      const verifier = readEntraVerifier(env);
      if (!verifier)
        throw new DomainError('DEPENDENCY_UNAVAILABLE', 'identity provider is not configured');
      subject = await verifyEntraIdentity(bearer, verifier);
    } else {
      // Synthetic sign-in — dev/staging only, never in production.
      if (isProd)
        throw new DomainError(
          'POLICY_BLOCKED',
          'synthetic sign-in is disabled in production; present a verified identity token',
        );
      const body = await c.req
        .json<{ idpSubject?: string }>()
        .catch(() => ({}) as { idpSubject?: string });
      subject = typeof body.idpSubject === 'string' ? body.idpSubject.trim() : '';
      if (!subject)
        throw new DomainError('AUTH_REQUIRED', 'idpSubject is required for synthetic sign-in');
    }

    // Map the subject to Potenova's own guardian/family ids and provision on first
    // sign-in (idempotent). Guardians only; children never reach this path.
    const { familyId, guardianId } = guardianRefForSubject(subject);
    let provisioned = false;
    if (!(await deps.identity.getFamily(familyId))) {
      await deps.identity.saveFamily({
        familyId,
        marketRegion: 'ca-on',
        legalOwnerGuardianId: guardianId,
        status: 'active',
      });
      await deps.identity.saveGuardian({
        guardianId,
        familyId,
        role: 'owner',
        status: 'active',
      });
      provisioned = true;
    }

    const cfg = readSessionConfig(env, isProd);
    const { token, expiresAt } = await issueGuardianSession(
      { guardianId, familyId, region: deps.config.primaryRegion },
      cfg,
      Date.parse(now()),
    );

    return c.json({
      token,
      tokenType: 'Bearer',
      expiresAt,
      provisioned,
      actor: { actorType: 'guardian', guardianId, familyId, role: 'owner', stepUp: false },
    });
  });

  // Step-up re-verification (ADR-0008). Elevates the caller's CURRENT guardian
  // session to a short-lived step_up=true token so they can perform a sensitive
  // action (billing, export, deletion, guardian grants). The re-verification
  // itself (MFA / passkey re-prompt) is the IdP's — synthetic here, and
  // FAIL-CLOSED in production, where a real re-verified token is required.
  app.post('/auth/step-up', async (c) => {
    // Synthetic step-up is a dev/staging affordance only; in production the real
    // IdP re-verification applies, so this endpoint is disabled there (fail-closed).
    if (isProd)
      throw new DomainError(
        'POLICY_BLOCKED',
        'synthetic step-up is disabled in production; re-verify with the identity provider',
      );

    const bearer = /^Bearer\s+(.+)$/i.exec(c.req.header('authorization') ?? '')?.[1];
    if (!bearer)
      throw new DomainError('AUTH_REQUIRED', 'a current guardian session is required to step up');

    const cfg = readSessionConfig(env, isProd);
    const session = await verifyGuardianSession(bearer, cfg);

    const at = now();
    const { token, expiresAt } = await issueGuardianSession(
      {
        guardianId: session.guardianId,
        familyId: session.familyId ?? '',
        region: session.region,
        stepUp: true,
        ttlSecondsOverride: STEP_UP_TTL_SECONDS,
      },
      cfg,
      Date.parse(at),
    );

    // Record the elevation on the immutable security audit log — who re-verified,
    // when, and the window it is valid for (ADR-0008/0034; SEC-001 audit trail).
    await deps.safety.recordAudit({
      approver: session.guardianId,
      reason: 'step_up_reverification',
      object: session.familyId ? `family:${session.familyId}` : `guardian:${session.guardianId}`,
      action: 'step_up_elevation',
      outcome: 'EXECUTED',
      expiry: expiresAt,
      at,
    });

    return c.json({
      token,
      tokenType: 'Bearer',
      expiresAt,
      actor: {
        actorType: 'guardian',
        guardianId: session.guardianId,
        familyId: session.familyId,
        role: 'owner',
        stepUp: true,
      },
    });
  });
}
