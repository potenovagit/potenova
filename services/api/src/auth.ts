import {
  type ActorContext,
  type ActorType,
  type Purpose,
  DomainError,
  isApprovedRegion,
} from '@potenova/contracts';
import type { Context } from 'hono';

/**
 * Dev authentication shim (WP-01 / ADR-0008 seam).
 *
 * Establishes the ActorContext from request headers. In production this comes
 * from a verified session issued by the managed IdP (passkeys/MFA, ADR-0008);
 * here it is header-driven so the API is exercisable end to end on synthetic
 * data. The authorization rules it feeds (role capabilities, actor-type gates,
 * residency) are the real domain guards, not shims.
 */
export interface AuthCtx {
  readonly actor: ActorContext;
  readonly guardianRole?: 'owner' | 'learning_viewer';
  readonly stepUp: boolean;
  readonly region: string;
}

export function readAuth(c: Context, defaultRegion: string): AuthCtx {
  const actorType = c.req.header('x-actor-type') as ActorType | undefined;
  const actorAlias = c.req.header('x-actor-alias');
  if (!actorType || !actorAlias) {
    throw new DomainError('AUTH_REQUIRED', 'x-actor-type and x-actor-alias are required');
  }
  const gr = c.req.header('x-guardian-role');
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
    stepUp: c.req.header('x-step-up') === 'true',
    region: c.req.header('x-processing-region') ?? defaultRegion,
  };
}

/** Restrict a route to specific actor types (fail-closed). */
export function requireActorType(a: AuthCtx, ...types: readonly ActorType[]): void {
  if (!types.includes(a.actor.actorType)) {
    throw new DomainError('FORBIDDEN_ROLE', `requires actor type: ${types.join(' | ')}`);
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
