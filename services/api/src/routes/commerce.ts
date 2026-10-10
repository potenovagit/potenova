import type { Hono } from 'hono';
import { confirmUpgrade } from '@potenova/billing';
import { readAuth, requireActorType } from '../auth';
import { now, type Deps } from '../deps';

/** Billing callbacks + entitlement reads (WP-12). Callbacks are idempotent at the
 *  database, so a duplicate provider event can never create a second grant. */
export function registerCommerce(app: Hono, deps: Deps): void {
  app.post('/billing/callbacks', async (c) => {
    const a = readAuth(c, deps.config.primaryRegion);
    requireActorType(a, 'billing_service', 'system');
    const b = await c.req.json<{
      channel: string;
      transactionId: string;
      familyId: string;
      kind: string;
    }>();
    const res = await deps.billing.recordCallback({ ...b, at: now() });
    if (res.applied && b.kind === 'grant') {
      const current = await deps.billing.getEntitlement(b.familyId);
      const next = confirmUpgrade((current?.state as never) ?? 'INACTIVE');
      await deps.billing.saveEntitlement({
        familyId: b.familyId,
        state: next.state,
        tierId: current?.tierId ?? null,
        updatedAt: now(),
      });
    }
    return c.json(res);
  });

  app.get('/families/:familyId/entitlement', async (c) => {
    const a = readAuth(c, deps.config.primaryRegion);
    requireActorType(a, 'guardian', 'billing_service', 'system');
    const entitlement = await deps.billing.getEntitlement(c.req.param('familyId'));
    return c.json({ entitlement });
  });
}
