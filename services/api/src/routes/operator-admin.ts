import type { Context, Hono } from 'hono';
import { DomainError } from '@potenova/contracts';
import { hashIdpSubject, isOperatorRole } from '@potenova/identity';
import { readAuth, requireOperatorPermission } from '../auth';
import { now, type Deps } from '../deps';

/**
 * Operator/admin console surface (synthetic, pre-G2), under least-privilege RBAC
 * (SEC-013):
 *  - GET  /operator/metrics            — roll-up counts + AI posture (operator:read)
 *  - POST /operator/accounts/:id/suspend | /reactivate — family account state
 *                                        (operator:account_admin)
 *  - POST /operator/operators          — register/deactivate an operator
 *                                        (operator:operator_admin)
 *
 * The privilege comes from the caller's verified RBAC role, never the actor type
 * alone — a read-only operator cannot mutate an account. Suspend/reactivate and
 * operator registration are audited on the immutable security log, and a
 * suspended family is refused a new child session at the edge (sessions route).
 * Account administration is never a mastery or content action.
 */
export function registerOperatorAdmin(app: Hono, deps: Deps): void {
  const auth = (c: Context) => readAuth(c, deps.config.primaryRegion);

  app.get('/operator/metrics', async (c) => {
    requireOperatorPermission(auth(c), 'operator:read');
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
    const a = auth(c);
    requireOperatorPermission(a, 'operator:account_admin');
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

  // Register (or update) another operator — admin-only identity administration
  // (SEC-002: operators are pre-provisioned, never self-created). The subject is
  // reduced to its hash before storage; the raw subject is never persisted. The
  // registration is audited.
  interface RegisterBody {
    idpSubject?: string;
    operatorId?: string;
    role?: string;
    status?: string;
  }
  app.post('/operator/operators', async (c) => {
    const a = auth(c);
    requireOperatorPermission(a, 'operator:operator_admin');
    const b = await c.req.json<RegisterBody>().catch(() => ({}) as RegisterBody);
    const subject = typeof b.idpSubject === 'string' ? b.idpSubject.trim() : '';
    if (!subject) throw new DomainError('POLICY_BLOCKED', 'idpSubject is required');
    if (!isOperatorRole(b.role))
      throw new DomainError('POLICY_BLOCKED', 'a valid role is required');
    const status = b.status === 'inactive' ? 'inactive' : 'active';
    const operatorId = (b.operatorId ?? '').trim() || `opr-${Date.now()}`;
    const at = now();
    await deps.identity.saveOperator({
      subjectHash: hashIdpSubject(subject),
      operatorId,
      role: b.role,
      status,
      linkedAt: at,
    });
    await deps.safety.recordAudit({
      approver: a.actor.actorAlias,
      reason: 'operator_administration',
      object: `operator:${operatorId}`,
      action: status === 'active' ? 'operator_register' : 'operator_deactivate',
      outcome: 'EXECUTED',
      expiry: null,
      at,
    });
    return c.json({ operatorId, role: b.role, status }, 201);
  });
}
