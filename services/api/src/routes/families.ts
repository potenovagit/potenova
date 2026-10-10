import type { Context, Hono } from 'hono';
import { DomainError } from '@potenova/contracts';
import { ageBandForGrade } from '@potenova/identity';
import { readAuth, requireActorType } from '../auth';
import { now, type Deps } from '../deps';

/** Families, learners and consent (WP-01). Parent-only; owner for mutations. */
export function registerFamilies(app: Hono, deps: Deps): void {
  const ownerOnly = (c: Context) => {
    const a = readAuth(c, deps.config.primaryRegion);
    requireActorType(a, 'guardian');
    if (a.guardianRole !== 'owner')
      throw new DomainError('FORBIDDEN_ROLE', 'account owner required');
    return a;
  };

  app.post('/families', async (c) => {
    ownerOnly(c);
    const b = await c.req.json<{
      familyId: string;
      marketRegion: string;
      legalOwnerGuardianId: string;
    }>();
    await deps.identity.saveFamily({
      familyId: b.familyId,
      marketRegion: b.marketRegion,
      legalOwnerGuardianId: b.legalOwnerGuardianId,
      status: 'active',
    });
    await deps.identity.saveGuardian({
      guardianId: b.legalOwnerGuardianId,
      familyId: b.familyId,
      role: 'owner',
      status: 'active',
    });
    return c.json({ familyId: b.familyId }, 201);
  });

  app.post('/families/:familyId/learners', async (c) => {
    ownerOnly(c);
    const familyId = c.req.param('familyId');
    const b = await c.req.json<{ learnerId: string; nickname: string; grade: number }>();
    const ageBand = ageBandForGrade(b.grade); // throws POLICY_BLOCKED outside Ontario G1-8
    await deps.identity.saveLearner({
      learnerId: b.learnerId,
      familyId,
      nickname: b.nickname,
      grade: b.grade,
      ageBand,
      lifecycleStatus: 'active',
    });
    return c.json({ learnerId: b.learnerId, ageBand }, 201);
  });

  app.post('/families/:familyId/consent', async (c) => {
    ownerOnly(c);
    const familyId = c.req.param('familyId');
    const b = await c.req.json<{
      grantId: string;
      purpose: string;
      modality: string;
      version: string;
    }>();
    await deps.identity.saveConsentGrant({
      grantId: b.grantId,
      familyId,
      purpose: b.purpose,
      version: b.version,
      modality: b.modality,
      state: 'GIVEN',
      grantedAt: now(),
      revokedAt: null,
    });
    return c.json({ grantId: b.grantId, state: 'GIVEN' }, 201);
  });

  app.get('/families/:familyId/consent', async (c) => {
    const a = readAuth(c, deps.config.primaryRegion);
    requireActorType(a, 'guardian');
    return c.json({ grants: await deps.identity.listConsentGrants(c.req.param('familyId')) });
  });

  app.post('/families/:familyId/consent/:grantId/revoke', async (c) => {
    ownerOnly(c);
    const familyId = c.req.param('familyId');
    const grantId = c.req.param('grantId');
    const grant = (await deps.identity.listConsentGrants(familyId)).find(
      (g) => g.grantId === grantId,
    );
    if (!grant) throw new DomainError('NOT_FOUND', 'consent grant not found');
    await deps.identity.saveConsentGrant({ ...grant, state: 'REVOKED', revokedAt: now() });
    return c.json({ grantId, state: 'REVOKED' });
  });
}
