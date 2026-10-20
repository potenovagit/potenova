import type { Context, Hono } from 'hono';
import { DomainError } from '@potenova/contracts';
import { hashIdpSubject, isOperatorRole } from '@potenova/identity';
import { learningActive, type EntitlementState } from '@potenova/billing';
import { estimateCost } from '@potenova/ai-gateway';
import { randomUUID } from 'node:crypto';
import { readAuth, requireOperatorPermission } from '../auth';
import { now, type Deps } from '../deps';
import { runNotificationDelivery } from '../notification-delivery';
import { runBillingSignalProcessing } from '../billing-signals';

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
    const [
      identity,
      byStatus,
      sessions,
      entitlements,
      billingHolds,
      disabledCaps,
      pendingDA,
      pendingNotes,
      ai,
    ] = await Promise.all([
      deps.identity.counts(),
      deps.identity.accountStatusCounts(),
      deps.session.sessionCounts(),
      deps.billing.entitlementStateCounts(),
      deps.billing.heldCount(),
      deps.operator.disabledCapabilities(),
      deps.safety.listPendingDualAuth(),
      deps.notifications.pendingCount(),
      deps.ai.candidateModelId
        ? Promise.resolve(deps.ai.registry.isApprovedForProduction(deps.ai.candidateModelId))
        : Promise.resolve(false),
    ]);
    const [evalStats, aiUsage, routeDecisions] = await Promise.all([
      deps.operator.evalRunStats(),
      deps.aiUsage.summary(),
      deps.routeLog.count(),
    ]);
    // Families with learning currently active by entitlement (billing posture).
    const learningActiveFamilies = Object.entries(entitlements).reduce(
      (sum, [state, n]) => sum + (learningActive(state as EntitlementState) ? n : 0),
      0,
    );
    return c.json({
      asOf: now(),
      accounts: { ...identity, byStatus }, // { families, guardians, learners, byStatus }
      sessions, // { total, active }
      billing: { entitlements, learningActiveFamilies, holds: billingHolds },
      safety: {
        killSwitchesDisabled: disabledCaps,
        pendingDualAuth: pendingDA.length,
      },
      notifications: { pending: pendingNotes },
      ai: {
        providerConfigured: deps.ai.provider !== null,
        candidateModelId: deps.ai.candidateModelId,
        anyModelApprovedForProduction: ai,
        evalRuns: evalStats.count,
        // AI-020: usage/cost observed alongside the eval outcomes above. Cost is
        // a DRAFT estimate from an unapproved per-unit rate, never a final figure.
        usage: {
          events: aiUsage.events,
          totalUnits: aiUsage.totalUnits,
          estimatedCostDraft: estimateCost(aiUsage.totalUnits),
        },
        routeDecisions,
      },
    });
  });

  // AI usage/cost drill-down (AI-013): by model / capability / provider. Pre-G2
  // the source is the synthetic eval path (no family/learner/session dimension
  // yet — those populate when a model is approved for child routing at G2).
  app.get('/operator/ai-usage', async (c) => {
    requireOperatorPermission(auth(c), 'operator:read');
    const [summary, byModel, byCapability, byProvider] = await Promise.all([
      deps.aiUsage.summary(),
      deps.aiUsage.breakdown('model'),
      deps.aiUsage.breakdown('capability'),
      deps.aiUsage.breakdown('provider'),
    ]);
    const withCost = (rows: { key: string; events: number; units: number }[]) =>
      rows.map((r) => ({ ...r, estimatedCostDraft: estimateCost(r.units) }));
    return c.json({
      summary: { ...summary, estimatedCostDraft: estimateCost(summary.totalUnits) },
      byModel: withCost(byModel),
      byCapability: withCost(byCapability),
      byProvider: withCost(byProvider),
      note: 'cost is a DRAFT estimate (unapproved per-unit rate, ER-01/NFR-14)',
    });
  });

  // Route probe (AI-006): exercise the gateway's task-specific routing across
  // capabilities (text / speech / vision) on synthetic inputs and LOG the
  // decision. Pre-G2 no model is APPROVED, so a production (child-context) route
  // fails closed to BLOCK with a reason — exactly what the log must capture.
  interface RouteProbeBody {
    capability?: string;
    modelId?: string;
    ageBand?: string;
    subject?: string;
    processingRegion?: string;
    childContext?: boolean;
  }
  app.post('/operator/route-probe', async (c) => {
    requireOperatorPermission(auth(c), 'operator:read');
    const b = await c.req.json<RouteProbeBody>().catch(() => ({}) as RouteProbeBody);
    if (!b.capability || !b.ageBand || !b.subject) {
      throw new DomainError('POLICY_BLOCKED', 'capability, ageBand and subject are required');
    }
    const processingRegion = b.processingRegion ?? deps.config.primaryRegion;
    const childContext = b.childContext ?? true;
    const requestedModel = (b.modelId ?? '').trim();
    const outcome = deps.ai.gateway.route({
      modelId: requestedModel,
      processingRegion,
      ageBand: b.ageBand,
      subject: b.subject,
      capability: b.capability,
      childContext,
    });
    const chosenModel = outcome.kind === 'BLOCK' ? null : outcome.modelId;
    const reasonCode = outcome.kind === 'BLOCK' ? outcome.reason : null;
    await deps.routeLog.record({
      decisionId: `rd-${randomUUID()}`,
      at: now(),
      capability: b.capability,
      requestedModel: requestedModel || null,
      chosenModel,
      outcome: outcome.kind,
      policy: 'residency>approval>envelope',
      reasonCode,
      processingRegion,
      childContext,
      synthetic: true,
      units: null,
    });
    return c.json({ capability: b.capability, outcome: outcome.kind, chosenModel, reasonCode });
  });

  // The AI route-decision log (AI-006), most recent first.
  app.get('/operator/route-decisions', async (c) => {
    requireOperatorPermission(auth(c), 'operator:read');
    const rows = await deps.routeLog.recent();
    return c.json({ decisions: rows });
  });

  // Pending notifications (the outbox a real delivery worker would drain).
  app.get('/operator/notifications', async (c) => {
    requireOperatorPermission(auth(c), 'operator:read');
    const rows = await deps.notifications.listPending();
    return c.json({
      notifications: rows.map((r) => ({
        notificationId: r.notificationId,
        recipient: r.recipient,
        familyId: r.familyId,
        kind: r.kind,
        createdAt: r.createdAt,
      })),
    });
  });

  // Drain the outbox (delivery worker). Fail-closed: with no approved, in-region
  // provider nothing is delivered — notifications are HELD. A privileged
  // operational action (in production a scheduled system job).
  app.post('/operator/notifications/dispatch', async (c) => {
    const a = auth(c);
    requireOperatorPermission(a, 'operator:account_admin');
    const summary = await runNotificationDelivery(deps);
    await deps.safety.recordAudit({
      approver: a.actor.actorAlias,
      reason: 'notification_dispatch',
      object: 'notifications:outbox',
      action: 'notification_dispatch',
      outcome: summary.delivered > 0 ? 'EXECUTED' : 'HELD',
      expiry: null,
      at: now(),
    });
    return c.json(summary);
  });

  // Process billing hold/resume signals (billing-service consumer). Applies the
  // billing HOLD overlay — never an entitlement-state transition.
  app.post('/operator/billing/process-signals', async (c) => {
    const a = auth(c);
    requireOperatorPermission(a, 'operator:account_admin');
    const summary = await runBillingSignalProcessing(deps);
    return c.json(summary);
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

    // Tie the account-status change into the billing + notification flows via the
    // outbox (a real worker drains it). We do NOT mutate the entitlement state
    // machine directly — account suspension is an administrative overlay that
    // already supersedes entitlement at the session edge, and the billing service
    // owns its own lifecycle (it consumes the hold/resume signal). A guardian
    // notification records the account-state change for the family.
    const enqueue = (recipient: string, kind: string) =>
      deps.notifications.enqueue({
        notificationId: `ntf-${randomUUID()}`,
        recipient,
        familyId,
        kind,
        payload: JSON.stringify({ familyId, status: next, by: a.actor.actorAlias }),
        createdAt: at,
      });
    await Promise.all([
      enqueue('guardian', disabled ? 'account_suspended' : 'account_reactivated'),
      enqueue('billing', disabled ? 'billing_hold' : 'billing_resume'),
    ]);

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
