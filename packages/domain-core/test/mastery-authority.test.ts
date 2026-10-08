import { describe, it, expect } from 'vitest';
import { promoteProjection, type ProjectionPromotion } from '@potenova/domain-core';
import { type ActorContext, isDomainError } from '@potenova/contracts';

const projector: ActorContext = {
  actorType: 'learner_state_projector',
  actorAlias: 'proj-1',
  familyAlias: null,
  purpose: 'evidence_projection',
};

const base: ProjectionPromotion = {
  learnerAlias: 'L-abc',
  skillId: 'SK-math-frac-01',
  fromProjectionVersion: 7,
  toState: 'INDEPENDENT',
  derivedFromShadowReplay: true,
  approvedPolicyVersion: 'mastery-policy-2026.10',
};

const actor = (t: ActorContext['actorType']): ActorContext => ({
  actorType: t,
  actorAlias: `${t}-1`,
  familyAlias: 'F-1',
  purpose: 'tutoring',
});

describe('mastery write authority (TM-07, TM-08, AT-56, Master §4)', () => {
  it('projector advances state via an evidence-derived replay', () => {
    const r = promoteProjection(projector, 7, base);
    expect(r.projectionVersion).toBe(8);
    expect(r.state).toBe('INDEPENDENT');
  });

  it.each(['tutor_engine', 'guardian', 'billing_service', 'child', 'operator'] as const)(
    'rejects a direct mastery write by %s',
    (t) => {
      try {
        promoteProjection(actor(t), 7, base);
        throw new Error('expected FORBIDDEN_ROLE');
      } catch (e) {
        expect(isDomainError(e) && e.code).toBe('FORBIDDEN_ROLE');
      }
    },
  );

  it('rejects a promotion not derived from a shadow replay', () => {
    try {
      promoteProjection(projector, 7, { ...base, derivedFromShadowReplay: false });
      throw new Error('expected POLICY_BLOCKED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('POLICY_BLOCKED');
    }
  });

  it('rejects a stale projection version (optimistic concurrency)', () => {
    try {
      promoteProjection(projector, 9, base);
      throw new Error('expected STALE_VERSION');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('STALE_VERSION');
    }
  });
});
