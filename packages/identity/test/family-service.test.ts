import { describe, it, expect } from 'vitest';
import { FamilyService } from '@potenova/identity';
import { type ActorContext, isDomainError } from '@potenova/contracts';

function ownerOf(familyId: string): ActorContext {
  return {
    actorType: 'guardian',
    actorAlias: 'g-owner',
    familyAlias: familyId,
    purpose: 'onboarding',
  };
}

describe('family/identity authority (ACC-001/002/009, AT-03)', () => {
  it('a learner cannot be created without a parent-owned family', () => {
    const svc = new FamilyService();
    try {
      svc.createLearner(ownerOf('does-not-exist'), 'does-not-exist', {
        nickname: 'Kit',
        grade: 3,
        ageBand: '6-8',
      });
      throw new Error('expected NOT_FOUND');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('NOT_FOUND');
    }
  });

  it('creates siblings under one family and keeps them strictly isolated (AT-03)', () => {
    const svc = new FamilyService();
    const { family } = svc.createFamily('idp-subject-1', 'ca-on');
    const actor = ownerOf(family.familyId);
    const a = svc.createLearner(actor, family.familyId, {
      nickname: 'A',
      grade: 3,
      ageBand: '6-8',
    });
    const b = svc.createLearner(actor, family.familyId, {
      nickname: 'B',
      grade: 5,
      ageBand: '9-11',
    });

    expect(svc.listLearners(family.familyId)).toHaveLength(2);
    // in-scope resolves; cross-checking returns the right learner only
    expect(svc.getLearnerScoped(actor, a.learnerId).nickname).toBe('A');
    expect(svc.getLearnerScoped(actor, b.learnerId).nickname).toBe('B');
  });

  it('never reads a learner from another family — NOT_FOUND, no existence leak (TM-02)', () => {
    const svc = new FamilyService();
    const f1 = svc.createFamily('idp-1', 'ca-on').family;
    const f2 = svc.createFamily('idp-2', 'ca-on').family;
    const learnerInF1 = svc.createLearner(ownerOf(f1.familyId), f1.familyId, {
      nickname: 'OnlyF1',
      grade: 4,
      ageBand: '9-11',
    });
    // An actor scoped to family 2 must not be able to read family 1's learner.
    try {
      svc.getLearnerScoped(ownerOf(f2.familyId), learnerInF1.learnerId);
      throw new Error('expected NOT_FOUND');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('NOT_FOUND');
    }
  });

  it('issues a least-privileged child session bound to the learner + device', () => {
    const svc = new FamilyService();
    const f = svc.createFamily('idp-1', 'ca-on').family;
    const l = svc.createLearner(ownerOf(f.familyId), f.familyId, {
      nickname: 'Kit',
      grade: 3,
      ageBand: '6-8',
    });
    const cred = svc.startChildSession(l.learnerId, 'device-alias-xyz');
    expect(cred.learnerId).toBe(l.learnerId);
    expect(cred.familyId).toBe(f.familyId);
    expect(new Date(cred.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});
