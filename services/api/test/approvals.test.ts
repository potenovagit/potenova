import { describe, it, expect, afterEach } from 'vitest';
import { createApp } from '../src/app';
import { buildPolicies } from '../src/deps';
import {
  masteryPolicyFrom,
  usageCapsFrom,
  escalationMatrixFromApproval,
  retentionPolicyFromApproval,
  parseApprovals,
} from '../src/approvals';
import { DATA_CLASSES, checkRetentionReadiness, type RetentionRule } from '@potenova/policy';
import { openDatabase, BillingRepository, type PotenovaDb } from '@potenova/persistence';

/**
 * Approval-flip: encoding a reviewer's decision is a CONFIG change (a signed
 * value dropped in → the policy flips to approved → prod unblocks for that gate),
 * never a code change. Absent an approval, prod stays fail-closed.
 */

const approvals = {
  mastery: { version: 'mastery-1.0(ER-03-approved)' },
  usageCaps: {
    setBy: 'child-safety-expert',
    bands: {
      primary: { maxContinuousMinutes: 20, maxDailyMinutes: 40, breakAfterMinutes: 10 },
      junior: { maxContinuousMinutes: 30, maxDailyMinutes: 60, breakAfterMinutes: 10 },
      intermediate: { maxContinuousMinutes: 40, maxDailyMinutes: 80, breakAfterMinutes: 10 },
    },
  },
};

// A signed escalation matrix (a single benign cell is enough to mark it signed;
// every unset cell still fails closed to max containment).
const escalationApproval = {
  cells: [
    {
      input: {
        category: 'general_distress' as const,
        severity: 'low' as const,
        confidence: 'low' as const,
        householdImplicated: false,
      },
      rule: {
        humanReview: false,
        parentNotify: 'standard' as const,
        responsePattern: 'standard_safe' as const,
      },
    },
  ],
};

// A signed retention schedule covering every in-use data class (ready = all signed).
const aRule: RetentionRule = { activeDays: 90, backupDays: 35, deletion: 'purge' };
const retentionApproval = {
  setBy: 'privacy-counsel',
  classes: Object.fromEntries(DATA_CLASSES.map((dc) => [dc, aRule])),
};
const fullApprovals = {
  ...approvals,
  escalation: escalationApproval,
  retention: retentionApproval,
};

describe('approval-flip — policy construction', () => {
  it('prod stays fail-closed without approvals', () => {
    const p = buildPolicies(true);
    expect(p.mastery.approved).toBe(false);
    expect(p.usageCaps.junior.status).toBe('pending'); // empty in prod → pending
  });

  it('an approval flips mastery + usage caps to approved', () => {
    const p = buildPolicies(true, approvals);
    expect(p.mastery.approved).toBe(true);
    expect(p.mastery.policyVersion).toBe('mastery-1.0(ER-03-approved)');
    const junior = p.usageCaps.junior;
    expect(junior.status).toBe('configured');
    if (junior.status === 'configured') {
      expect(junior.approved).toBe(true);
      expect(junior.setBy).toBe('child-safety-expert');
    }
  });

  it('non-prod keeps DRAFT values (configured but unapproved) when no approval', () => {
    const p = buildPolicies(false);
    expect(p.mastery.approved).toBe(false);
    const junior = p.usageCaps.junior;
    expect(junior.status).toBe('configured'); // staging-illustrative
    if (junior.status === 'configured') expect(junior.approved).toBe(false);
  });

  it('masteryPolicyFrom keeps DRAFT numbers unless the approval overrides them', () => {
    expect(masteryPolicyFrom().approved).toBe(false); // the DRAFT
    const m = masteryPolicyFrom({ version: 'v', minUnaidedForIndependent: 4 });
    expect(m.approved).toBe(true);
    expect(m.minUnaidedForIndependent).toBe(4); // overridden
    expect(m.minRepresentationsForIndependent).toBe(2); // DRAFT default retained
  });

  it('usageCapsFrom only configures the bands the reviewer signed', () => {
    const caps = usageCapsFrom({
      setBy: 'x',
      bands: { junior: { maxContinuousMinutes: 25, maxDailyMinutes: 50, breakAfterMinutes: 10 } },
    });
    expect(caps?.junior.status).toBe('configured');
    expect(caps?.primary.status).toBe('pending'); // omitted → fail-closed
  });

  it('parseApprovals reads env JSON and ignores invalid/absent', () => {
    expect(parseApprovals({})).toBeUndefined();
    expect(parseApprovals({ POTENOVA_APPROVALS: 'not json' })).toBeUndefined();
    const c = parseApprovals({ POTENOVA_APPROVALS: JSON.stringify(approvals) });
    expect(c?.mastery?.version).toBe('mastery-1.0(ER-03-approved)');
  });

  it('a signed escalation matrix is approved (unset cells still fail closed)', () => {
    expect(escalationMatrixFromApproval()).toBeUndefined();
    const m = escalationMatrixFromApproval(escalationApproval);
    expect(m?.approved).toBe(true);
    expect(Object.keys(m?.rules ?? {}).length).toBe(1);
    const p = buildPolicies(true, { escalation: escalationApproval });
    expect(p.escalation.approved).toBe(true);
  });

  it('a signed retention schedule configures every signed class → ready', () => {
    expect(retentionPolicyFromApproval()).toBeUndefined();
    const p = buildPolicies(true, { retention: retentionApproval });
    const readiness = checkRetentionReadiness(p.retention, DATA_CLASSES);
    expect(readiness.ready).toBe(true);
    // A partial schedule leaves the rest pending → not ready.
    const partial = buildPolicies(true, {
      retention: { setBy: 'x', classes: { billing: aRule } },
    });
    expect(checkRetentionReadiness(partial.retention, DATA_CLASSES).ready).toBe(false);
  });
});

// Through the running app, in a PROD config.
const prodEnv = { APP_ENV: 'prod', PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' };
const owner = {
  'x-actor-type': 'guardian',
  'x-actor-alias': 'g1',
  'x-guardian-role': 'owner',
  'x-family-alias': 'fam1',
};
const child = { 'x-actor-type': 'child', 'x-actor-alias': 'kid1', 'x-family-alias': 'fam1' };
const operator = { 'x-actor-type': 'operator', 'x-actor-alias': 'op1' };

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

async function onboard(app: ReturnType<typeof createApp>, db: PotenovaDb) {
  await app.request(
    '/families',
    json(owner, { familyId: 'fam1', marketRegion: 'ca-on', legalOwnerGuardianId: 'g1' }),
  );
  await app.request(
    '/families/fam1/learners',
    json(owner, { learnerId: 'kid1', nickname: 'Kid', grade: 5 }),
  );
  await app.request(
    '/families/fam1/consent',
    json(owner, { grantId: 'cg1', purpose: 'child_learning', modality: 'text', version: 'v1' }),
  );
  await new BillingRepository(db).saveEntitlement({
    familyId: 'fam1',
    state: 'PAID_ACTIVE',
    tierId: 't1',
    updatedAt: '2026-10-16T00:00:00Z',
  });
}

describe('approval-flip — prod unblock through the app', () => {
  it('a prod session is blocked without approvals, allowed once the caps are signed', async () => {
    const db1 = openDatabase();
    dbs.push(db1);
    const app1 = createApp({ env: prodEnv, db: db1 });
    await onboard(app1, db1);
    const blocked = await app1.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', requestedMinutes: 20 }),
    );
    // Empty prod caps fail closed → the age-cap precondition is not satisfied.
    expect(blocked.status).toBe(422);

    const db2 = openDatabase();
    dbs.push(db2);
    const app2 = createApp({ env: prodEnv, db: db2, approvals });
    await onboard(app2, db2);
    const ok = await app2.request(
      '/learners/kid1/sessions',
      json(child, { subject: 'math', requestedMinutes: 20 }),
    );
    expect(ok.status).toBe(201);

    // The operator view reflects the flip.
    const s = await (await app2.request('/operator/status', json(operator))).json();
    expect(s.policies.mastery.approved).toBe(true);
    expect(s.policies.usageCaps.allApproved).toBe(true);
  });

  it('a fully-signed config reports prodReady: true in the operator view', async () => {
    const db = openDatabase();
    dbs.push(db);
    const app = createApp({ env: prodEnv, db, approvals: fullApprovals });
    const s = await (await app.request('/operator/status', json(operator))).json();
    expect(s.policies.mastery.approved).toBe(true);
    expect(s.policies.usageCaps.allApproved).toBe(true);
    expect(s.policies.escalation.approved).toBe(true);
    expect(s.policies.retention.ready).toBe(true);
    // Every EVIDENCE-REQUIRED gate signed → the fail-closed posture clears.
    expect(s.prodReady).toBe(true);
  });
});
