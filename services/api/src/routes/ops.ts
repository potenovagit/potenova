import type { Hono } from 'hono';
import { readAuth, requireActorType } from '../auth';
import { now, type Deps } from '../deps';

/** Operator surface (WP-13): kill switches and content quarantine, each audited
 *  and persisted so the action survives a restart. */
export function registerOps(app: Hono, deps: Deps): void {
  app.post('/operator/kill-switch', async (c) => {
    const a = readAuth(c, deps.config.primaryRegion);
    requireActorType(a, 'operator');
    const b = await c.req.json<{ capability: string; disabled: boolean; reason: string }>();
    const at = now();
    await deps.operator.setKillSwitch({
      capability: b.capability,
      disabled: b.disabled,
      actor: a.actor.actorAlias,
      reason: b.reason,
      at,
    });
    await deps.safety.recordAudit({
      approver: a.actor.actorAlias,
      reason: b.reason,
      object: b.capability,
      action: b.disabled ? 'kill_switch_disable' : 'kill_switch_enable',
      outcome: 'EXECUTED',
      expiry: null,
      at,
    });
    return c.json({ capability: b.capability, active: !b.disabled });
  });

  app.get('/operator/kill-switch/:capability', async (c) => {
    const a = readAuth(c, deps.config.primaryRegion);
    requireActorType(a, 'operator');
    return c.json({
      capability: c.req.param('capability'),
      active: await deps.operator.isCapabilityActive(c.req.param('capability')),
    });
  });

  app.post('/operator/quarantine', async (c) => {
    const a = readAuth(c, deps.config.primaryRegion);
    requireActorType(a, 'operator', 'child_safety');
    const b = await c.req.json<{ assetId: string; assetVersion: string; reasonCode: string }>();
    const at = now();
    const regressionCaseId = `RC-${Date.now()}-${b.assetId}`;
    await deps.content.quarantine({
      assetId: b.assetId,
      assetVersion: b.assetVersion,
      reasonCode: b.reasonCode,
      actor: a.actor.actorAlias,
      at,
      regressionCaseId,
    });
    await deps.safety.recordAudit({
      approver: a.actor.actorAlias,
      reason: b.reasonCode,
      object: b.assetId,
      action: 'content_quarantine',
      outcome: 'EXECUTED',
      expiry: null,
      at,
    });
    return c.json({ quarantined: true, regressionCaseId });
  });
}
