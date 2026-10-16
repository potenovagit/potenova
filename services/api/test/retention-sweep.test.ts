import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import {
  openDatabase,
  SessionRepository,
  SafetyRepository,
  type PotenovaDb,
} from '@potenova/persistence';

/**
 * Retention-expiry sweep (ER-07): apply the schedule to actually age-out records.
 * From-creation stores past their active window are purged (or flagged in dryRun);
 * unapproved classes fail closed (blocked) in prod. Synthetic data; operator-only.
 */

const env = { APP_ENV: 'staging', PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' };
const prodEnv = { APP_ENV: 'prod', PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' };
const operator = { 'x-actor-type': 'operator', 'x-actor-alias': 'op1' };
const guardian = { 'x-actor-type': 'guardian', 'x-actor-alias': 'g1', 'x-family-alias': 'fam1' };

// A signed retention schedule covering every class (reused for the prod flip).
const retentionApproval = {
  setBy: 'privacy-counsel',
  classes: Object.fromEntries(
    [
      'learner_identity',
      'diagnostic_responses',
      'ai_prompts',
      'learner_evidence',
      'safety_incidents',
      'support_tickets',
      'parent_reports',
      'analytics',
      'billing',
      'security_audit',
      'backup_dr',
    ].map((dc) => [
      dc,
      { activeDays: dc === 'analytics' ? 90 : 730, backupDays: 35, deletion: 'purge' as const },
    ]),
  ),
};

let dbs: PotenovaDb[] = [];
afterEach(async () => {
  await Promise.all(dbs.map((d) => d.close()));
  dbs = [];
});

const json = (headers: Record<string, string>, body?: unknown) => ({
  method: body === undefined ? 'GET' : 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const today = () => new Date().toISOString().slice(0, 10);

async function seedUsageAndAudit(db: PotenovaDb) {
  const sess = new SessionRepository(db);
  await sess.addUsageMinutes('kid1', '2020-01-01', 10); // old → past 90d analytics window
  await sess.addUsageMinutes('kid1', today(), 10); // recent → retained
  const safety = new SafetyRepository(db);
  await safety.recordAudit({
    approver: 'op0',
    reason: 'old',
    object: 'x',
    action: 'test',
    outcome: 'EXECUTED',
    expiry: null,
    at: '2020-01-01T00:00:00Z', // past 730d security_audit window
  });
  await safety.recordAudit({
    approver: 'op0',
    reason: 'recent',
    object: 'y',
    action: 'test',
    outcome: 'EXECUTED',
    expiry: null,
    at: new Date().toISOString(),
  });
}

const findClass = (report: Array<{ dataClass: string }>, dc: string) =>
  report.find((r) => r.dataClass === dc)!;

describe('retention-expiry sweep (ER-07)', () => {
  it('purges from-creation records past their window; retains recent ones', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    await seedUsageAndAudit(db);

    const res = await app.request('/privacy/retention/sweep', json(operator, {}));
    expect(res.status).toBe(200);
    const body = await res.json();

    const analytics = findClass(body.report, 'analytics') as {
      scanned: number;
      due: number;
      actioned: number;
      status: string;
    };
    expect(analytics.scanned).toBe(2);
    expect(analytics.due).toBe(1); // only the 2020 row is past the 90-day window
    expect(analytics.actioned).toBe(1);
    expect(analytics.status).toBe('swept');

    const audit = findClass(body.report, 'security_audit') as { due: number; actioned: number };
    expect(audit.due).toBe(1);
    expect(audit.actioned).toBe(1);

    // The old usage row is actually gone; the recent one remains.
    const sess = new SessionRepository(db);
    expect(await sess.getUsageMinutes('kid1', '2020-01-01')).toBe(0);
    expect(await sess.getUsageMinutes('kid1', today())).toBe(10);

    // Closure-basis and no-store classes are reported, not age-swept here.
    expect((findClass(body.report, 'learner_evidence') as { status: string }).status).toBe(
      'closure_basis',
    );
    expect((findClass(body.report, 'ai_prompts') as { status: string }).status).toBe(
      'no_first_party_store',
    );
  });

  it('dryRun flags due records without deleting them', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    await seedUsageAndAudit(db);

    const body = await (
      await app.request('/privacy/retention/sweep', json(operator, { dryRun: true }))
    ).json();
    const analytics = findClass(body.report, 'analytics') as {
      due: number;
      actioned: number;
      status: string;
    };
    expect(analytics.due).toBe(1);
    expect(analytics.actioned).toBe(0);
    expect(analytics.status).toBe('dry_run');
    // Nothing deleted.
    const sess = new SessionRepository(db);
    expect(await sess.getUsageMinutes('kid1', '2020-01-01')).toBe(10);
  });

  it('fails closed in prod until the schedule is signed (approval-flip)', async () => {
    // No approvals → proposed schedule is unapproved → every class BLOCKED in prod.
    const db1 = openDatabase();
    dbs.push(db1);
    const app1 = createApp({ env: prodEnv, db: db1 });
    await seedUsageAndAudit(db1);
    const blocked = await (
      await app1.request('/privacy/retention/sweep', json(operator, {}))
    ).json();
    expect((findClass(blocked.report, 'analytics') as { status: string }).status).toBe('blocked');
    expect(blocked.summary.totalActioned).toBe(0);
    // Old record NOT deleted — no unapproved-schedule deletion in prod.
    expect(await new SessionRepository(db1).getUsageMinutes('kid1', '2020-01-01')).toBe(10);

    // Signed schedule → the sweep ages records out.
    const db2 = openDatabase();
    dbs.push(db2);
    const app2 = createApp({ env: prodEnv, db: db2, approvals: { retention: retentionApproval } });
    await seedUsageAndAudit(db2);
    const swept = await (await app2.request('/privacy/retention/sweep', json(operator, {}))).json();
    expect((findClass(swept.report, 'analytics') as { status: string }).status).toBe('swept');
    expect((findClass(swept.report, 'analytics') as { actioned: number }).actioned).toBe(1);
    expect(await new SessionRepository(db2).getUsageMinutes('kid1', '2020-01-01')).toBe(0);
  });

  it('is operator-only', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env, db });
    const res = await app.request('/privacy/retention/sweep', json(guardian, {}));
    expect(res.status).toBe(403);
  });
});
