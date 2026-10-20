import type { Context, Hono } from 'hono';
import { DomainError } from '@potenova/contracts';
import {
  isDualAuthAction,
  dualAuthRule,
  DUAL_AUTH_REQUEST_TTL_SECONDS,
  type DualAuthAction,
} from '@potenova/identity';
import { randomUUID } from 'node:crypto';
import { readAuth, requireOperatorPermission, type AuthCtx } from '../auth';
import { now, type Deps } from '../deps';

/**
 * Dual authorization for the highest-risk operator actions (SEC-003):
 * separation of duty (maker-checker). One operator REQUESTS; a DIFFERENT operator
 * APPROVES; only then does the action execute. On top of least-privilege RBAC
 * (SEC-013) and JIT elevation (SEC-002) — both parties must hold the action's
 * permission and be elevated — so no single operator can independently export
 * bulk child data or disable a critical safety control. Every transition is on
 * the immutable security audit.
 *
 *   POST /operator/dual-auth/requests                 — request (requester)
 *   GET  /operator/dual-auth/requests                 — list pending (read)
 *   POST /operator/dual-auth/requests/:id/approve     — approve + execute (≠ requester)
 *   POST /operator/dual-auth/requests/:id/deny        — deny
 *
 * Synthetic, pre-G2. The SET of highest-risk actions is EVIDENCE REQUIRED
 * (owner: Security — ADR-0040); the registry default is the two the requirement
 * names.
 */

type Params = Record<string, unknown>;

/** Execute an approved action. Synthetic effects only (pre-G2, no real child data). */
async function executeDualAuthAction(
  deps: Deps,
  action: DualAuthAction,
  params: Params,
  by: string,
): Promise<unknown> {
  if (action === 'child_data.bulk_export') {
    const familyId = typeof params.familyId === 'string' ? params.familyId : '';
    if (!familyId) throw new DomainError('POLICY_BLOCKED', 'familyId is required');
    // A synthetic export manifest — learner ids only, never child content.
    const learnerIds = await deps.identity.listLearnerIdsByFamily(familyId);
    return { kind: 'export_manifest', scope: 'family', familyId, learnerCount: learnerIds.length };
  }
  if (action === 'safety_control.disable') {
    const capability =
      typeof params.control === 'string'
        ? params.control
        : typeof params.capability === 'string'
          ? params.capability
          : '';
    if (!capability) throw new DomainError('POLICY_BLOCKED', 'control is required');
    await deps.operator.setKillSwitch({
      capability,
      disabled: true,
      actor: by,
      reason: 'dual_authorized',
      at: now(),
    });
    return { kind: 'safety_control_disabled', capability, active: false };
  }
  // Unreachable: action is validated against the registry before execution.
  throw new DomainError('POLICY_BLOCKED', 'unsupported dual-auth action');
}

export function registerOperatorDualAuth(app: Hono, deps: Deps): void {
  const auth = (c: Context): AuthCtx => readAuth(c, deps.config.primaryRegion);

  interface RequestBody {
    action?: string;
    params?: Params;
    reason?: string;
  }
  app.post('/operator/dual-auth/requests', async (c) => {
    const a = auth(c);
    const b = await c.req.json<RequestBody>().catch(() => ({}) as RequestBody);
    if (!isDualAuthAction(b.action))
      throw new DomainError('POLICY_BLOCKED', 'a defined dual-auth action is required');
    const rule = dualAuthRule(b.action);
    // The requester must hold the permission AND be elevated (SEC-013 + SEC-002).
    requireOperatorPermission(a, rule.permission);
    const reason = typeof b.reason === 'string' && b.reason.trim() ? b.reason.trim() : '';
    if (!reason) throw new DomainError('POLICY_BLOCKED', 'a reason is required');

    const at = now();
    const requestId = `da-${randomUUID()}`;
    const expiresAt = new Date(Date.parse(at) + DUAL_AUTH_REQUEST_TTL_SECONDS * 1000).toISOString();
    await deps.safety.createDualAuthRequest({
      requestId,
      action: b.action,
      params: JSON.stringify(b.params ?? {}),
      reason,
      requestedBy: a.actor.actorAlias,
      requestedAt: at,
      status: 'PENDING',
      approvedBy: null,
      decidedAt: null,
      expiresAt,
    });
    await deps.safety.recordAudit({
      approver: a.actor.actorAlias,
      reason,
      object: `dual_auth:${requestId}`,
      action: `dual_auth_requested:${b.action}`,
      outcome: 'PENDING',
      expiry: expiresAt,
      at,
    });
    return c.json({ requestId, action: b.action, status: 'PENDING', expiresAt }, 201);
  });

  app.get('/operator/dual-auth/requests', async (c) => {
    requireOperatorPermission(auth(c), 'operator:read');
    const rows = await deps.safety.listPendingDualAuth();
    return c.json({
      requests: rows.map((r) => ({
        requestId: r.requestId,
        action: r.action,
        reason: r.reason,
        requestedBy: r.requestedBy,
        requestedAt: r.requestedAt,
        expiresAt: r.expiresAt,
      })),
    });
  });

  app.post('/operator/dual-auth/requests/:id/approve', async (c) => {
    const a = auth(c);
    const id = c.req.param('id');
    const req = await deps.safety.getDualAuthRequest(id);
    if (!req) throw new DomainError('NOT_FOUND', 'dual-auth request not found');
    if (req.status !== 'PENDING')
      throw new DomainError('POLICY_BLOCKED', `request is ${req.status.toLowerCase()}`);
    if (!isDualAuthAction(req.action))
      throw new DomainError('POLICY_BLOCKED', 'unsupported dual-auth action');
    const rule = dualAuthRule(req.action);
    // The approver must independently hold the permission AND be elevated.
    requireOperatorPermission(a, rule.permission);
    // Separation of duty: the requester can never approve their own request.
    if (a.actor.actorAlias === req.requestedBy)
      throw new DomainError('FORBIDDEN_ROLE', 'the requester cannot approve their own request');

    const at = now();
    if (Date.parse(at) > Date.parse(req.expiresAt)) {
      await deps.safety.updateDualAuthStatus(id, { status: 'EXPIRED', decidedAt: at });
      throw new DomainError('POLICY_BLOCKED', 'request has expired');
    }
    // Compare-and-set to CONSUMED first, so two approvers cannot double-execute.
    const won = await deps.safety.updateDualAuthStatus(id, {
      status: 'CONSUMED',
      approvedBy: a.actor.actorAlias,
      decidedAt: at,
    });
    if (!won) throw new DomainError('POLICY_BLOCKED', 'request is no longer pending');

    const params = JSON.parse(req.params) as Params;
    const result = await executeDualAuthAction(
      deps,
      req.action,
      params,
      `${req.requestedBy}+${a.actor.actorAlias}`,
    );
    await deps.safety.recordAudit({
      approver: a.actor.actorAlias,
      reason: `dual_authorized; requested_by=${req.requestedBy}`,
      object: `dual_auth:${id}`,
      action: `dual_auth_approved:${req.action}`,
      outcome: 'EXECUTED',
      expiry: null,
      at,
    });
    return c.json({ requestId: id, action: req.action, status: 'CONSUMED', result });
  });

  app.post('/operator/dual-auth/requests/:id/deny', async (c) => {
    const a = auth(c);
    const id = c.req.param('id');
    const req = await deps.safety.getDualAuthRequest(id);
    if (!req) throw new DomainError('NOT_FOUND', 'dual-auth request not found');
    if (req.status !== 'PENDING')
      throw new DomainError('POLICY_BLOCKED', `request is ${req.status.toLowerCase()}`);
    if (!isDualAuthAction(req.action))
      throw new DomainError('POLICY_BLOCKED', 'unsupported dual-auth action');
    requireOperatorPermission(a, dualAuthRule(req.action).permission);

    const at = now();
    await deps.safety.updateDualAuthStatus(id, {
      status: 'DENIED',
      approvedBy: a.actor.actorAlias,
      decidedAt: at,
    });
    await deps.safety.recordAudit({
      approver: a.actor.actorAlias,
      reason: `dual_auth_denied; requested_by=${req.requestedBy}`,
      object: `dual_auth:${id}`,
      action: `dual_auth_denied:${req.action}`,
      outcome: 'DENIED',
      expiry: null,
      at,
    });
    return c.json({ requestId: id, action: req.action, status: 'DENIED' });
  });
}
