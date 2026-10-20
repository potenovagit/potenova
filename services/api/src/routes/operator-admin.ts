import type { Context, Hono } from 'hono';
import { DomainError } from '@potenova/contracts';
import { readAuth, requireActorType } from '../auth';
import { now, type Deps } from '../deps';

/**
 * Operator/admin console surface (synthetic, pre-G2):
 *  - GET  /operator/metrics            — roll-up counts + AI posture (read-only)
 *  - POST /operator/accounts/:id/suspend | /reactivate — family account state
 *
 * Operator-only. Suspend/reactivate are audited on the immutable security log,
 * and a suspended family is refused a new child session at the edge (sessions
 * route). This is account administration, never a mastery or content action.
 */
export function registerOperatorAdmin(app: Hono, deps: Deps): void {
  const operator = (c: Context) => {
    const a = readAuth(c, deps.config.primaryRegion);
    requireActorType(a, 'operator');
    return a;
  };

  app.get('/operator/metrics', async (c) => {
    operator(c);
    const [identity, sessions] = await Promise.all([
      deps.identity.counts(),
      deps.session.sessionCounts(),
    ]);
    return c.json({
      asOf: now(),
      accounts: identity, // { families, guardians, learners }
      sessions, // { total, active }
      ai: {
        providerConfigured: deps.ai.provider !== null,
        candidateModelId: deps.ai.candidateModelId,
        anyModelApprovedForProduction: deps.ai.candidateModelId
          ? deps.ai.registry.isApprovedForProduction(deps.ai.candidateModelId)
          : false,
      },
    });
  });

  const setStatus = (disabled: boolean) => async (c: Context) => {
    const a = operator(c);
    const familyId = c.req.param('familyId');
    if (!familyId) throw new DomainError('NOT_FOUND', 'family id required');
    const fam = await deps.identity.getFamily(familyId);
    if (!fam) throw new DomainError('NOT_FOUND', 'family not found');
    const next = disabled ? 'suspended' : 'active';
    await deps.identity.setFamilyStatus(familyId, next);
    const at = now();
    await deps.safety.recordAudit({
      approver: a.actor.actorAlias,
      reason: 'account_administration',
      object: `family:${familyId}`,
      action: disabled ? 'account_suspend' : 'account_reactivate',
      outcome: 'EXECUTED',
      expiry: null,
      at,
    });
    return c.json({ familyId, status: next });
  };

  app.post('/operator/accounts/:familyId/suspend', setStatus(true));
  app.post('/operator/accounts/:familyId/reactivate', setStatus(false));
}
