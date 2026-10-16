import type { Context, Hono } from 'hono';
import { DomainError } from '@potenova/contracts';
import {
  planErasure,
  recordTargetOutcome,
  verifyErasure,
  evaluateRetention,
  DATA_CLASSES,
  type ErasureRecord,
  type ErasureReason,
  type DeletionStatus,
  type DataClass,
} from '@potenova/policy';
import { readAuth, requireActorType, type AuthCtx } from '../auth';
import { now, type Deps } from '../deps';

/**
 * Data-subject erasure (PRIV-005 / NFR-17 / TM-48).
 *
 * A right-to-erasure request must reach EVERY store the subject's data lives in,
 * and is "done" only when each required target reports a terminal success — it
 * fails closed otherwise (the deletion module is the authority). This route wires
 * that mechanism to the real first-party store: it actually deletes the learner's
 * rows (synthetic data), records that target as completed, and then requires the
 * external targets (analytics, AI provider, backups) to be ATTESTED before the
 * request can read as complete. The first-party deletion happens immediately; the
 * request state stays PENDING until every target is accounted for. Operator-only;
 * the action is written to the security audit log (reason codes only).
 */

const ERASURE_REASONS: readonly ErasureReason[] = [
  'account_closure',
  'subject_request',
  'retention_expiry',
];
const ERASURE_SUBJECTS = ['learner', 'family'] as const;
type ErasureSubject = (typeof ERASURE_SUBJECTS)[number];

/** Financial rows are held under their own retention obligation, not purged by a
 *  subject-erasure — whether erasure overrides that hold is a counsel decision. */
const BILLING_RETENTION_BASIS =
  'financial-records retention (ER-07 billing class) — retained, not purged by erasure; confirm with privacy counsel';
const DELETION_STATUSES: readonly DeletionStatus[] = [
  'pending',
  'completed',
  'tombstoned',
  'not_applicable',
  'failed',
];

interface ErasureBody {
  subjectType?: string;
  subjectId?: string;
  reason?: string;
}
interface AttestBody {
  targetId?: string;
  status?: string;
  note?: string;
}

export function registerPrivacy(app: Hono, deps: Deps): void {
  const operator = (c: Context): AuthCtx => {
    const a = readAuth(c, deps.config.primaryRegion);
    requireActorType(a, 'operator');
    return a;
  };

  const load = async (requestId: string): Promise<{ record: ErasureRecord; state: string }> => {
    const row = await deps.erasure.getDataSubjectRequest(requestId);
    if (!row || !row.outcomesJson) throw new DomainError('NOT_FOUND', 'erasure request not found');
    return { record: JSON.parse(row.outcomesJson) as ErasureRecord, state: row.state };
  };

  const persist = async (
    requestId: string,
    subjectType: string,
    subjectId: string,
    reason: string,
    record: ErasureRecord,
  ): Promise<{ state: string; verification: ReturnType<typeof verifyErasure> }> => {
    const verification = verifyErasure(record);
    const state = verification.complete ? 'COMPLETE' : 'PENDING';
    await deps.erasure.saveDataSubjectRequest({
      requestId,
      kind: 'erasure',
      subjectType,
      subjectId,
      reason,
      state,
      outcomesJson: JSON.stringify(record),
      updatedAt: now(),
    });
    return { state, verification };
  };

  // Start an erasure: delete the first-party store now; external targets pending.
  // A 'learner' subject erases that one learner's rows; a 'family' subject cascades
  // across every learner under the family plus the family-level identity rows
  // (family, guardians, consent grants). Billing/financial rows are retained under
  // their retention obligation and reported, never purged here (fail-closed).
  app.post('/privacy/erasure', async (c) => {
    const a = operator(c);
    const b = await c.req.json<ErasureBody>().catch(() => ({}) as ErasureBody);
    if (!b.subjectType || !ERASURE_SUBJECTS.includes(b.subjectType as ErasureSubject)) {
      throw new DomainError('POLICY_BLOCKED', "subjectType must be 'learner' or 'family'");
    }
    if (!b.subjectId) throw new DomainError('POLICY_BLOCKED', 'subjectId is required');
    if (!b.reason || !ERASURE_REASONS.includes(b.reason as ErasureReason)) {
      throw new DomainError('POLICY_BLOCKED', 'reason must be a valid erasure reason');
    }

    const subjectType = b.subjectType as ErasureSubject;
    const requestId = `dsr-${Date.now()}-${b.subjectId}`;
    const plan = planErasure({
      subjectType,
      subjectId: b.subjectId,
      reason: b.reason as ErasureReason,
      requestedAt: now(),
    });

    // Actually delete the first-party rows (synthetic data), then record the
    // first_party_store target completed. External targets stay pending.
    let deleted: unknown;
    let note: string;
    if (subjectType === 'learner') {
      deleted = await deps.erasure.deleteLearnerData(b.subjectId);
      note = `first-party rows deleted: ${JSON.stringify(deleted)}`;
    } else {
      const learnerIds = await deps.identity.listLearnerIdsByFamily(b.subjectId);
      const learners: Record<
        string,
        Awaited<ReturnType<typeof deps.erasure.deleteLearnerData>>
      > = {};
      for (const id of learnerIds) {
        learners[id] = await deps.erasure.deleteLearnerData(id);
      }
      const familyIdentity = await deps.erasure.deleteFamilyIdentity(b.subjectId);
      const billing = await deps.erasure.countFamilyBilling(b.subjectId);
      deleted = {
        scope: 'family',
        family: b.subjectId,
        learnerCount: learnerIds.length,
        learners,
        familyIdentity,
        billingRetained: { ...billing, basis: BILLING_RETENTION_BASIS },
      };
      note =
        `family cascade — ${learnerIds.length} learner(s) + identity deleted ` +
        `(${familyIdentity.guardians} guardian(s), ${familyIdentity.consentGrants} consent grant(s)); ` +
        `billing retained ${JSON.stringify(billing)}`;
    }

    const record = recordTargetOutcome(plan, 'first_party_store', 'completed', {
      at: now(),
      note,
    });

    const { state, verification } = await persist(
      requestId,
      subjectType,
      b.subjectId,
      b.reason,
      record,
    );

    await deps.safety.recordAudit({
      approver: a.actor.actorAlias,
      reason: b.reason,
      object: `${subjectType}:${b.subjectId}`,
      action: 'erasure_first_party_deleted',
      outcome: 'EXECUTED',
      expiry: null,
      at: now(),
    });

    return c.json({ requestId, subjectType, state, deleted, record, verification }, 201);
  });

  // Attest an external target's outcome (analytics / provider / backups).
  app.post('/privacy/erasure/:requestId/attest', async (c) => {
    const a = operator(c);
    const requestId = c.req.param('requestId');
    const b = await c.req.json<AttestBody>().catch(() => ({}) as AttestBody);
    if (!b.targetId) throw new DomainError('POLICY_BLOCKED', 'targetId is required');
    if (!b.status || !DELETION_STATUSES.includes(b.status as DeletionStatus)) {
      throw new DomainError('POLICY_BLOCKED', 'status must be a valid deletion status');
    }

    const row = await deps.erasure.getDataSubjectRequest(requestId);
    if (!row || !row.outcomesJson) throw new DomainError('NOT_FOUND', 'erasure request not found');
    const record = JSON.parse(row.outcomesJson) as ErasureRecord;

    // recordTargetOutcome throws NOT_FOUND if the target isn't in the plan.
    const updated = recordTargetOutcome(record, b.targetId, b.status as DeletionStatus, {
      at: now(),
      note: b.note,
    });
    const { state, verification } = await persist(
      requestId,
      row.subjectType ?? 'learner',
      row.subjectId ?? '',
      row.reason ?? 'subject_request',
      updated,
    );

    await deps.safety.recordAudit({
      approver: a.actor.actorAlias,
      reason: `${b.targetId}:${b.status}`,
      object: `erasure:${requestId}`,
      action: 'erasure_target_attested',
      outcome: 'EXECUTED',
      expiry: null,
      at: now(),
    });

    return c.json({ requestId, state, record: updated, verification });
  });

  // Status of an erasure request (fail-closed until every target is accounted for).
  app.get('/privacy/erasure/:requestId', async (c) => {
    operator(c);
    const { record, state } = await load(c.req.param('requestId'));
    return c.json({
      requestId: c.req.param('requestId'),
      state,
      record,
      verification: verifyErasure(record),
    });
  });

  // Retention-expiry sweep (ER-07): apply the approved schedule to actually
  // age-out first-party records. Each data class is evaluated against its rule;
  // records past the active window in an age-able (from-creation) store are
  // purged (or flagged in dryRun). Fail-closed: a class whose rule is not
  // configured/approved (in prod) is BLOCKED and nothing is deleted for it —
  // from-account-closure stores are reported but aged by the erasure flow (§PRIV-005),
  // not here. The approved schedule arrives via the approval-flip (POTENOVA_APPROVALS).
  app.post('/privacy/retention/sweep', async (c) => {
    const a = operator(c);
    const b = await c.req
      .json<{ dryRun?: boolean; asOf?: string }>()
      .catch(() => ({}) as { dryRun?: boolean; asOf?: string });
    const dryRun = b.dryRun === true;
    const asOf = b.asOf && !Number.isNaN(Date.parse(b.asOf)) ? b.asOf : now();
    const nowMs = Date.parse(asOf);
    const requireApproved = deps.policies.isProd;
    const policy = deps.policies.retention;

    const scan = await deps.retentionStore.scanAgeable();
    const counts = await deps.retentionStore.storeCounts();
    const buckets: Record<string, { id: string; ts: string }[]> = {
      usage: scan.usage,
      securityAudit: scan.securityAudit,
      billing: scan.billing,
    };

    // Each data class → how its first-party records are handled.
    const AGEABLE: Partial<Record<DataClass, 'usage' | 'securityAudit' | 'billing'>> = {
      analytics: 'usage',
      security_audit: 'securityAudit',
      billing: 'billing',
    };
    const CLOSURE: Partial<Record<DataClass, number>> = {
      learner_evidence: counts.evidence,
      diagnostic_responses: counts.diagnosticRuns,
    };

    const ageDaysOf = (ts: string): number => {
      const iso = ts.length === 10 ? `${ts}T00:00:00Z` : ts;
      return Math.floor((nowMs - Date.parse(iso)) / 86_400_000);
    };

    const report: Array<Record<string, unknown>> = [];
    let totalDue = 0;
    let totalActioned = 0;

    for (const dc of DATA_CLASSES) {
      const v = policy[dc];
      const rule = v?.status === 'configured' ? v.value : null;
      const base = {
        dataClass: dc,
        activeDays: rule?.activeDays ?? null,
        deletion: rule?.deletion ?? null,
        basis: rule?.basis ?? null,
      };

      // Fail-closed: unconfigured / (in prod) unapproved → BLOCKED, nothing deleted.
      if (evaluateRetention(policy, dc, 0, { requireApproved }).action === 'blocked_unconfigured') {
        report.push({ ...base, store: null, scanned: 0, due: 0, actioned: 0, status: 'blocked' });
        continue;
      }

      const bucket = AGEABLE[dc];
      if (bucket) {
        const rows = buckets[bucket];
        const dueIds: string[] = [];
        for (const r of rows) {
          if (
            evaluateRetention(policy, dc, ageDaysOf(r.ts), { requireApproved }).action ===
            'due_for_deletion'
          ) {
            dueIds.push(r.id);
          }
        }
        let actioned = 0;
        if (!dryRun && dueIds.length > 0) {
          actioned =
            bucket === 'usage'
              ? await deps.retentionStore.deleteUsage(dueIds)
              : bucket === 'securityAudit'
                ? await deps.retentionStore.deleteSecurityAudit(dueIds)
                : await deps.retentionStore.deleteBilling(dueIds);
        }
        totalDue += dueIds.length;
        totalActioned += actioned;
        report.push({
          ...base,
          store: bucket,
          scanned: rows.length,
          due: dueIds.length,
          actioned,
          status: dryRun ? 'dry_run' : 'swept',
        });
        continue;
      }

      if (dc in CLOSURE) {
        report.push({
          ...base,
          store: dc === 'learner_evidence' ? 'mastery_evidence' : 'diagnostic_run',
          scanned: CLOSURE[dc],
          due: 0,
          actioned: 0,
          status: 'closure_basis', // aged on account closure via erasure (PRIV-005)
        });
        continue;
      }

      report.push({
        ...base,
        store: null,
        scanned: 0,
        due: 0,
        actioned: 0,
        status: 'no_first_party_store',
      });
    }

    await deps.safety.recordAudit({
      approver: a.actor.actorAlias,
      reason: dryRun ? 'retention_sweep_dry_run' : 'retention_sweep',
      object: 'retention:all_classes',
      action: 'retention_sweep',
      outcome: 'EXECUTED',
      expiry: null,
      at: now(),
    });

    return c.json({
      asOf,
      dryRun,
      requireApproved,
      summary: { classes: DATA_CLASSES.length, totalDue, totalActioned },
      report,
    });
  });
}
