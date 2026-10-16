import type { Context, Hono } from 'hono';
import { DomainError } from '@potenova/contracts';
import {
  planErasure,
  recordTargetOutcome,
  verifyErasure,
  type ErasureRecord,
  type ErasureReason,
  type DeletionStatus,
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
  app.post('/privacy/erasure', async (c) => {
    const a = operator(c);
    const b = await c.req.json<ErasureBody>().catch(() => ({}) as ErasureBody);
    if (b.subjectType !== 'learner') {
      throw new DomainError('POLICY_BLOCKED', "subjectType must be 'learner'");
    }
    if (!b.subjectId) throw new DomainError('POLICY_BLOCKED', 'subjectId is required');
    if (!b.reason || !ERASURE_REASONS.includes(b.reason as ErasureReason)) {
      throw new DomainError('POLICY_BLOCKED', 'reason must be a valid erasure reason');
    }

    const requestId = `dsr-${Date.now()}-${b.subjectId}`;
    const plan = planErasure({
      subjectType: 'learner',
      subjectId: b.subjectId,
      reason: b.reason as ErasureReason,
      requestedAt: now(),
    });

    // Actually delete the learner's first-party rows (synthetic data).
    const deleted = await deps.erasure.deleteLearnerData(b.subjectId);
    const record = recordTargetOutcome(plan, 'first_party_store', 'completed', {
      at: now(),
      note: `first-party rows deleted: ${JSON.stringify(deleted)}`,
    });

    const { state, verification } = await persist(
      requestId,
      'learner',
      b.subjectId,
      b.reason,
      record,
    );

    await deps.safety.recordAudit({
      approver: a.actor.actorAlias,
      reason: b.reason,
      object: `learner:${b.subjectId}`,
      action: 'erasure_first_party_deleted',
      outcome: 'EXECUTED',
      expiry: null,
      at: now(),
    });

    return c.json({ requestId, state, deleted, record, verification }, 201);
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
}
