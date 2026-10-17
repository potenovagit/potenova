import type { Context, Hono } from 'hono';
import { DomainError } from '@potenova/contracts';
import { selectLesson } from '@potenova/curriculum';
import { readAuth, requireActorType, assertRegion, type AuthCtx } from '../auth';
import { type Deps } from '../deps';
import { courseOfSkill, deriveLessonKey } from '../adaptive';

/**
 * "Learn it" / step-by-step teaching delivery (LRN).
 *
 * Returns an AUTHORED, approved worked explanation for a skill, selected to the
 * child's weakness. The selection key is derived SERVER-SIDE (ADR-0021 follow-up):
 * the misconception comes from the skill's authored KB, and the representation
 * from the child's own evidence (the one they most need among the remediation's
 * representations). A client may still pass a misconception, but it is honoured
 * only when valid for the skill — the server never trusts it blindly.
 *
 * Personalisation is by SELECTION only — the library is fixed, approved content;
 * nothing is generated for the child, so the content gate holds. `selectLesson`
 * returns only lessons that are approved with a signed ref; this route
 * double-checks that invariant before serving, and returns `{ lesson: null }`
 * when nothing approved matches (the UI then shows a minimal fallback rather
 * than anything unvetted).
 *
 * Child-actor, consent-fenced (no delivery before consent), region-checked.
 */

async function hasChildLearningConsent(deps: Deps, familyAlias: string | null): Promise<boolean> {
  if (!familyAlias) return false;
  const grants = await deps.identity.listConsentGrants(familyAlias);
  return grants.some((g) => g.purpose === 'child_learning' && g.state === 'GIVEN');
}

export function registerLessons(app: Hono, deps: Deps): void {
  const authed = (c: Context): AuthCtx => {
    const a = readAuth(c, deps.config.primaryRegion);
    assertRegion(a);
    return a;
  };

  app.get('/learners/:alias/lessons/:skillId', async (c) => {
    const a = authed(c);
    requireActorType(a, 'child');
    const alias = c.req.param('alias');
    const skillId = c.req.param('skillId');

    // Consent fence — nothing reaches the child before consent.
    if (!(await hasChildLearningConsent(deps, a.actor.familyAlias))) {
      throw new DomainError('CONSENT_REQUIRED', 'no active child_learning consent for this family');
    }
    const learner = await deps.identity.getLearner(alias);
    if (!learner) throw new DomainError('NOT_FOUND', 'learner not found');

    const course = courseOfSkill(skillId);
    if (!course) return c.json({ lesson: null });

    // Server-derive the selection key: misconception from the KB (client value
    // honoured only if valid for the skill), representation from the child's
    // own evidence for this skill.
    const evidence = await deps.evidence.listEvidence(alias, skillId);
    const key = deriveLessonKey(course, skillId, evidence, c.req.query('misconception') ?? null);

    const lesson = selectLesson({
      skillId,
      misconceptionId: key.misconceptionId,
      representation: key.representation,
    });
    // Defence in depth: never serve anything the gate wouldn't trust.
    if (lesson && (!lesson.approved || !lesson.approvalRef)) {
      return c.json({ lesson: null });
    }
    return c.json({ lesson, selection: key });
  });
}
