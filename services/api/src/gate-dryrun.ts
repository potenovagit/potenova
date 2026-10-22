import { createApp } from './app';
import {
  openDatabase,
  EvidenceRepository,
  BillingRepository,
  type PotenovaDb,
} from '@potenova/persistence';
import type { MasteryEvidence } from '@potenova/learner-state';

/**
 * Gate-checklist DRY-RUN harness (Stage 2, synthetic).
 *
 * Stands up the live API over an in-memory synthetic database and drives it
 * through each fail-closed non-negotiable at the HTTP edge, recording the
 * actual status/code against the expected fail-closed behaviour. This is an
 * end-to-end, single-transcript demonstration an owner can file toward G2 — it
 * is NOT a substitute for the external specialist sign-offs (privacy/legal,
 * child-safety, accessibility), which decide the policy VALUES; it only shows
 * the mechanisms hold on synthetic data with the policies that exist today.
 *
 * Nothing here uses a real model or real child data. No child content is placed
 * in the recorded transcript — only request paths, status codes and the
 * property under test.
 */

export interface GateCheck {
  readonly id: string;
  readonly gate: string;
  readonly reqIds: readonly string[];
  readonly property: string;
  readonly expected: string;
  readonly observed: string;
  readonly result: 'PASS' | 'FAIL';
}

export interface GateDryRunReport {
  readonly runId: string;
  readonly at: string;
  readonly environment: string;
  readonly dataset: 'synthetic';
  readonly checks: readonly GateCheck[];
  readonly summary: { readonly total: number; readonly passed: number; readonly failed: number };
  readonly allPass: boolean;
}

const ENV = { APP_ENV: 'staging', PRIMARY_REGION: 'ca-central', DR_REGION: 'ca-east' };
const owner = {
  'x-actor-type': 'guardian',
  'x-actor-alias': 'g1',
  'x-guardian-role': 'owner',
  'x-family-alias': 'fam1',
};
const owner2 = {
  'x-actor-type': 'guardian',
  'x-actor-alias': 'g2',
  'x-guardian-role': 'owner',
  'x-family-alias': 'fam2',
};
const child = { 'x-actor-type': 'child', 'x-actor-alias': 'kid1', 'x-family-alias': 'fam1' };
const operator = { 'x-actor-type': 'operator', 'x-actor-alias': 'op1', 'x-operator-role': 'admin' };

type Headers = Record<string, string>;
const req = (headers: Headers, body?: unknown) => ({
  method: body === undefined ? 'GET' : 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

async function codeOf(res: Response): Promise<string> {
  try {
    const b = (await res.clone().json()) as { code?: string };
    return b.code ?? '';
  } catch {
    return '';
  }
}

export async function runGateDryRun(): Promise<GateDryRunReport> {
  const db: PotenovaDb = openDatabase(); // in-memory, synthetic
  try {
    const app = createApp({ env: ENV, db });
    const checks: GateCheck[] = [];
    const record = (c: GateCheck) => checks.push(c);

    // --- synthetic family + learner + entitlement (NOT consent — gate 1 needs it absent) ---
    await app.request(
      '/families',
      req(owner, { familyId: 'fam1', marketRegion: 'ca-on', legalOwnerGuardianId: 'g1' }),
    );
    await app.request(
      '/families',
      req(owner2, { familyId: 'fam2', marketRegion: 'ca-on', legalOwnerGuardianId: 'g2' }),
    );
    await app.request(
      '/families/fam1/learners',
      req(owner, { learnerId: 'kid1', nickname: 'Kid', grade: 3 }),
    );
    await new BillingRepository(db).saveEntitlement({
      familyId: 'fam1',
      state: 'PAID_ACTIVE',
      tierId: 't1',
      updatedAt: '2026-10-22T00:00:00Z',
    });

    // GATE 1 — Consent fence (NFR-04): no processing before consent.
    {
      const res = await app.request(
        '/learners/kid1/sessions',
        req(child, { subject: 'math', requestedMinutes: 20 }),
      );
      const code = await codeOf(res);
      record({
        id: 'G-CONSENT-BEFORE',
        gate: 'Consent fence',
        reqIds: ['NFR-04', 'ER-10'],
        property: 'A child session cannot start before an active child_learning consent grant',
        expected: '403 CONSENT_REQUIRED',
        observed: `${res.status} ${code}`,
        result: res.status === 403 && code === 'CONSENT_REQUIRED' ? 'PASS' : 'FAIL',
      });
    }

    // Give consent, then a session must start (the fence opens).
    await app.request(
      '/families/fam1/consent',
      req(owner, { grantId: 'cg1', purpose: 'child_learning', modality: 'text', version: 'v1' }),
    );
    let sessionId = '';
    {
      const res = await app.request(
        '/learners/kid1/sessions',
        req(child, { subject: 'math', requestedMinutes: 20 }),
      );
      const body = (await res
        .clone()
        .json()
        .catch(() => ({}))) as {
        session?: { sessionId?: string; state?: string };
      };
      sessionId = body.session?.sessionId ?? '';
      record({
        id: 'G-CONSENT-AFTER',
        gate: 'Consent fence',
        reqIds: ['NFR-04'],
        property: 'With consent + entitlement, a session starts and is ACTIVE',
        expected: '201 session ACTIVE',
        observed: `${res.status} ${body.session?.state ?? '-'}`,
        result: res.status === 201 && body.session?.state === 'ACTIVE' ? 'PASS' : 'FAIL',
      });
    }

    // GATE 2 — Content gate (SEC-015 / AI-001): nothing unvalidated reaches a child.
    {
      // Negative: an unknown/unservable skill is refused on the delivery path.
      const bad = await app.request(
        `/learners/kid1/sessions/${sessionId}/task?skillId=SK-DOES-NOT-EXIST`,
        req(child, {}),
      );
      const badCode = await codeOf(bad);
      record({
        id: 'G-CONTENT-UNSERVABLE',
        gate: 'Content gate',
        reqIds: ['SEC-015', 'AI-001'],
        property: 'The delivery path refuses to serve content for an unservable/unknown skill',
        expected: '422 POLICY_BLOCKED',
        observed: `${bad.status} ${badCode}`,
        result: bad.status === 422 && badCode === 'POLICY_BLOCKED' ? 'PASS' : 'FAIL',
      });
      // Positive: a bank task is delivered only after its key passes the oracle.
      const good = await app.request(
        `/learners/kid1/sessions/${sessionId}/task?taskId=frac-cmp-1`,
        req(child, {}),
      );
      record({
        id: 'G-CONTENT-VALIDATED',
        gate: 'Content gate',
        reqIds: ['SEC-015', 'AI-001'],
        property: 'A validated bank task is delivered (answer key checked by the oracle)',
        expected: '200 task delivered',
        observed: `${good.status}`,
        result: good.status === 200 ? 'PASS' : 'FAIL',
      });
    }

    // GATE 3 — Canadian residency (NFR-02 / AT-55): processing outside the allowlist is refused.
    {
      const res = await app.request(
        '/learners/kid1/sessions',
        req(
          { ...child, 'x-processing-region': 'us-east-1' },
          { subject: 'math', requestedMinutes: 20 },
        ),
      );
      const code = await codeOf(res);
      record({
        id: 'G-RESIDENCY',
        gate: 'Canadian residency',
        reqIds: ['NFR-02', 'AT-55'],
        property: 'A request whose processing region is outside the Canadian allowlist is refused',
        expected: '451 REGION_DISALLOWED',
        observed: `${res.status} ${code}`,
        result: res.status === 451 && code === 'REGION_DISALLOWED' ? 'PASS' : 'FAIL',
      });
    }

    // GATE 4 — Mastery authority integrity (TM-07/08): mastery is derived, never set,
    // and reads are tenant-isolated; the conceptual claim is advisory until ER-03 is approved.
    {
      const read = await app.request('/learners/kid1/conceptual/SK-FR-equiv', req(owner));
      const body = (await read
        .clone()
        .json()
        .catch(() => ({}))) as {
        policyApproved?: boolean;
        state?: string;
      };
      record({
        id: 'G-MASTERY-ADVISORY',
        gate: 'Mastery authority',
        reqIds: ['TM-07', 'TM-08', 'ER-03'],
        property:
          'The conceptual-mastery read is advisory (candidate policy, not an approved claim)',
        expected: '200 policyApproved=false',
        observed: `${read.status} policyApproved=${String(body.policyApproved)}`,
        result: read.status === 200 && body.policyApproved === false ? 'PASS' : 'FAIL',
      });
      const cross = await app.request('/learners/kid1/conceptual/SK-FR-equiv', req(owner2));
      const crossCode = await codeOf(cross);
      record({
        id: 'G-MASTERY-ISOLATION',
        gate: 'Mastery authority',
        reqIds: ['TM-45', 'SEC-013'],
        property: 'A guardian cannot read a learner outside their own family (tenant isolation)',
        expected: '403 FORBIDDEN_ROLE',
        observed: `${cross.status} ${crossCode}`,
        result: cross.status === 403 && crossCode === 'FORBIDDEN_ROLE' ? 'PASS' : 'FAIL',
      });
    }

    // GATE 5 — Consent revocation (NFR-04): revoking consent stops further processing.
    {
      await app.request('/families/fam1/consent/cg1/revoke', req(owner, {}));
      const res = await app.request(
        '/learners/kid1/sessions',
        req(child, { subject: 'math', requestedMinutes: 20 }),
      );
      const code = await codeOf(res);
      record({
        id: 'G-CONSENT-REVOKE',
        gate: 'Consent fence',
        reqIds: ['NFR-04', 'ER-10'],
        property: 'After consent is revoked, a new session is blocked again (stop on revocation)',
        expected: '403 CONSENT_REQUIRED',
        observed: `${res.status} ${code}`,
        result: res.status === 403 && code === 'CONSENT_REQUIRED' ? 'PASS' : 'FAIL',
      });
    }

    // GATE 6 — Right to erasure (NFR-17 / PRIV-005): first-party rows deleted, fail-closed
    // until every external target is attested.
    {
      // Seed a couple of synthetic evidence rows so there is first-party data to erase.
      const repo = new EvidenceRepository(db);
      for (let i = 0; i < 2; i++) {
        const e: MasteryEvidence = {
          eventId: `dryrun-ev-${i}`,
          learnerAlias: 'kid1',
          skillId: 'SK-FR-equiv',
          mode: 'independent_check',
          assistanceBand: 'A0',
          correct: true,
          representation: 'area-model',
          recognitionConfidence: 1,
          observedAt: '2026-10-22T00:00:00Z',
          curriculumReleaseId: 'REL-ONT-MATH-2020-draft',
          schemaVersion: 'evt-0.1',
        };
        await repo.appendEvidence(e);
      }
      const start = await app.request(
        '/privacy/erasure',
        req(operator, { subjectType: 'learner', subjectId: 'kid1', reason: 'subject_request' }),
      );
      const startBody = (await start
        .clone()
        .json()
        .catch(() => ({}))) as {
        requestId?: string;
        state?: string;
      };
      const remaining = await repo.listEvidence('kid1', 'SK-FR-equiv');
      record({
        id: 'G-ERASURE-FIRSTPARTY',
        gate: 'Right to erasure',
        reqIds: ['NFR-17', 'PRIV-005', 'TM-48'],
        property:
          'An operator erasure deletes first-party rows immediately and stays PENDING (fail-closed) until external targets attest',
        expected: '201 state=PENDING, 0 first-party rows remain',
        observed: `${start.status} state=${startBody.state} remainingRows=${remaining.length}`,
        result:
          start.status === 201 && startBody.state === 'PENDING' && remaining.length === 0
            ? 'PASS'
            : 'FAIL',
      });
      // Attest the external targets → the request can now read COMPLETE.
      const requestId = startBody.requestId ?? '';
      for (const targetId of ['analytics', 'provider:azure_openai', 'backups']) {
        await app.request(
          `/privacy/erasure/${requestId}/attest`,
          req(operator, { targetId, status: 'completed', note: 'synthetic dry-run attestation' }),
        );
      }
      const status = await app.request(`/privacy/erasure/${requestId}`, req(operator));
      const statusBody = (await status
        .clone()
        .json()
        .catch(() => ({}))) as { state?: string };
      record({
        id: 'G-ERASURE-COMPLETE',
        gate: 'Right to erasure',
        reqIds: ['NFR-17', 'PRIV-005'],
        property: 'Once every target is attested, the erasure request reads COMPLETE',
        expected: 'state=COMPLETE',
        observed: `${status.status} state=${statusBody.state}`,
        result: status.status === 200 && statusBody.state === 'COMPLETE' ? 'PASS' : 'FAIL',
      });
    }

    // GATE 7 — Retention sweep dry-run (ER-07): a dry-run deletes NOTHING, and the
    // schedule is reported as unapproved (proposed). The prod fail-closed-BLOCKED
    // path for an unapproved schedule is covered by the policy unit tests.
    {
      const res = await app.request('/privacy/retention/sweep', req(operator, { dryRun: true }));
      const body = (await res
        .clone()
        .json()
        .catch(() => ({}))) as {
        dryRun?: boolean;
        requireApproved?: boolean;
        summary?: { totalActioned?: number };
        report?: Array<{ status?: string }>;
      };
      const actioned = body.summary?.totalActioned ?? -1;
      const noneSwept = (body.report ?? []).every((r) => r.status !== 'swept');
      record({
        id: 'G-RETENTION-DRYRUN',
        gate: 'Retention schedule',
        reqIds: ['ER-07', 'NFR-17'],
        property:
          'A retention dry-run deletes nothing (no class swept, totalActioned=0) — safe to run before an approved schedule exists',
        expected: 'dryRun=true, totalActioned=0, no class swept',
        observed: `${res.status} dryRun=${String(body.dryRun)} actioned=${actioned} noneSwept=${noneSwept}`,
        result:
          res.status === 200 && body.dryRun === true && actioned === 0 && noneSwept
            ? 'PASS'
            : 'FAIL',
      });
    }

    // GATE 8 — AI routing fail-closed (NFR-02 / gateway): with no approved in-region
    // provider configured, the evaluation path refuses rather than reaching any model.
    {
      const res = await app.request('/operator/model-eval', req(operator, {}));
      const code = await codeOf(res);
      record({
        id: 'G-AI-FAILCLOSED',
        gate: 'AI routing',
        reqIds: ['NFR-02', 'ER-16'],
        property:
          'With no approved in-region provider configured, the eval path fails closed (no model reached)',
        expected: '503 DEPENDENCY_UNAVAILABLE',
        observed: `${res.status} ${code}`,
        result: res.status === 503 && code === 'DEPENDENCY_UNAVAILABLE' ? 'PASS' : 'FAIL',
      });
    }

    const passed = checks.filter((c) => c.result === 'PASS').length;
    const failed = checks.length - passed;
    return {
      runId: `dryrun-${Date.now()}`,
      at: new Date().toISOString(),
      environment: ENV.APP_ENV,
      dataset: 'synthetic',
      checks,
      summary: { total: checks.length, passed, failed },
      allPass: failed === 0,
    };
  } finally {
    await db.close();
  }
}

/** Render a filable Markdown evidence report from a dry-run result. */
export function renderGateDryRunReport(r: GateDryRunReport): string {
  const rows = r.checks
    .map(
      (c) =>
        `| ${c.result === 'PASS' ? '✅' : '❌'} | ${c.gate} | \`${c.id}\` | ${c.reqIds.join(', ')} | ${c.property} | ${c.expected} | ${c.observed} |`,
    )
    .join('\n');
  return `# Stage-2 gate dry-run — ${r.runId}

- **When:** ${r.at}
- **Environment:** ${r.environment}
- **Dataset:** ${r.dataset} (no real model, no real child data)
- **Result:** ${r.summary.passed}/${r.summary.total} PASS${r.allPass ? ' — all gates held' : ` — ${r.summary.failed} FAILED`}

This is an end-to-end demonstration that the fail-closed MECHANISMS hold at the HTTP edge on synthetic data, with the policies configured today. It is **not** a specialist sign-off: the privacy/legal (ER-07/ER-10/SEC-009/SEC-012), child-safety (ER-08/ER-09) and accessibility (NFR-06) gates decide the policy VALUES and are not exercised or certified here. No child content is recorded below.

| | Gate | Check | Req IDs | Property | Expected | Observed |
|---|------|-------|---------|----------|----------|----------|
${rows}
`;
}
