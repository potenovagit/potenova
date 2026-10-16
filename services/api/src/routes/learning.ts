import type { Context, Hono } from 'hono';
import { DomainError } from '@potenova/contracts';
import { projectShadow, type MasteryEvidence, type SkillProjection } from '@potenova/learner-state';
import { buildDashboard, whyThisToday } from '@potenova/parent';
import {
  selectNextProbe,
  DRAFT_DIAGNOSTIC_POLICY,
  type DiagnosticCandidate,
} from '@potenova/diagnostic';
import {
  decideDelivery,
  type CandidateContent,
  type ApprovedFallback,
} from '@potenova/domain-core';
import { readAuth, requireActorType, assertRegion, type AuthCtx } from '../auth';
import type { Deps } from '../deps';
import {
  subjectOfSkill,
  computeNext,
  reviewDueFor,
  DEFAULT_COURSE,
  type Subject,
} from '../adaptive';

/** Consent fence at the edge (PRIV-004; AT-01): learning processing needs an
 *  active child_learning grant for the family. */
async function assertLearningConsent(deps: Deps, familyAlias: string | null): Promise<void> {
  if (!familyAlias)
    throw new DomainError('CONSENT_REQUIRED', 'x-family-alias required to check consent');
  const grants = await deps.identity.listConsentGrants(familyAlias);
  const ok = grants.some((g) => g.purpose === 'child_learning' && g.state === 'GIVEN');
  if (!ok)
    throw new DomainError('CONSENT_REQUIRED', 'no active child_learning consent for this family');
}

async function projectionFor(
  deps: Deps,
  learnerAlias: string,
  skillId: string,
): Promise<SkillProjection> {
  const events = await deps.evidence.listEvidence(learnerAlias, skillId);
  const corrections = await deps.evidence.listCorrections(events.map((e) => e.eventId));
  return projectShadow(learnerAlias, skillId, events, corrections);
}

export function registerLearning(app: Hono, deps: Deps): void {
  const authed = (c: Context): AuthCtx => {
    const a = readAuth(c, deps.config.primaryRegion);
    assertRegion(a);
    return a;
  };

  // Evidence ingest — producer/tutor only (tutor/parent/billing never write mastery),
  // behind the consent fence. Persists the immutable observation.
  app.post('/learners/:alias/skills/:skillId/evidence', async (c) => {
    const a = authed(c);
    requireActorType(a, 'evidence_producer', 'tutor_engine');
    await assertLearningConsent(deps, a.actor.familyAlias);
    const alias = c.req.param('alias');
    const skillId = c.req.param('skillId');
    const b = await c.req.json<Omit<MasteryEvidence, 'learnerAlias' | 'skillId'>>();
    await deps.evidence.appendEvidence({ ...b, learnerAlias: alias, skillId });
    return c.json({ accepted: true, eventId: b.eventId }, 202);
  });

  // Derived mastery projection (never a stored, hand-set value).
  app.get('/learners/:alias/skills/:skillId/projection', async (c) => {
    authed(c);
    const projection = await projectionFor(deps, c.req.param('alias'), c.req.param('skillId'));
    return c.json({ projection });
  });

  // Parent dashboard over several skills (view_progress).
  app.get('/learners/:alias/dashboard', async (c) => {
    const a = authed(c);
    requireActorType(a, 'guardian');
    const alias = c.req.param('alias');
    // An explicit skills list is honoured; otherwise show every skill the learner
    // has worked, grouped by subject (Math and English side by side).
    const requested = (c.req.query('skills') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const skills =
      requested.length > 0
        ? requested
        : [...new Set((await deps.evidence.listEvidenceForLearner(alias)).map((e) => e.skillId))];
    const projections: SkillProjection[] = [];
    for (const skillId of skills) projections.push(await projectionFor(deps, alias, skillId));

    // Per-skill cue: a mastered skill not practised in a while is due for review;
    // a mastered skill not yet shown in a novel context is ready for a challenge.
    const cueBy: Record<string, string> = {};
    for (const p of projections) {
      if (!p.dimensions.independent) continue;
      if (await reviewDueFor(deps, alias, p.skillId)) cueBy[p.skillId] = 'REVIEW_DUE';
      else if (!p.dimensions.transferable) cueBy[p.skillId] = 'TRANSFER_READY';
    }

    const base = buildDashboard(
      alias,
      projections,
      (id) => subjectOfSkill(id) ?? 'other',
      (id) => cueBy[id],
    );

    // "Why this today?" per subject: the planner's current objective for that
    // subject, with a plain-language reason. PAR-016 — reason code only, never
    // raw internal chain-of-thought.
    const bySubject = await Promise.all(
      base.bySubject.map(async (g) => {
        if (g.subject !== 'math' && g.subject !== 'english') return g;
        // Subject-level dashboard focus uses that subject's default course.
        const next = await computeNext(deps, alias, DEFAULT_COURSE[g.subject as Subject]);
        return {
          ...g,
          nextFocus: {
            skillId: next.skillId,
            reasonCode: next.reasonCode,
            explanation: next.explanation,
            exposesChainOfThought: whyThisToday(next.reasonCode).exposesChainOfThought,
          },
        };
      }),
    );
    return c.json({ ...base, bySubject });
  });

  // Diagnostic next-probe selection (pure; returns a skill to probe, not content).
  app.post('/diagnostic/next-probe', async (c) => {
    authed(c);
    const b = await c.req.json<{ learnerGrade: number; candidates: DiagnosticCandidate[] }>();
    const probe = selectNextProbe(b.candidates, b.learnerGrade, DRAFT_DIAGNOSTIC_POLICY);
    return c.json({ probe });
  });

  // Child-facing delivery gate: nothing unvalidated reaches a child (AI-001).
  app.post('/content/deliver', async (c) => {
    authed(c);
    const b = await c.req.json<{
      candidate: CandidateContent;
      fallback?: ApprovedFallback | null;
    }>();
    const outcome = decideDelivery(b.candidate, b.fallback ?? null);
    return c.json({ outcome });
  });
}
