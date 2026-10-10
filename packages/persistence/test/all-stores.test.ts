import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  openDatabase,
  IdentityRepository,
  BillingRepository,
  ContentRepository,
  SafetyRepository,
  OperatorRepository,
  SessionRepository,
  CurriculumRepository,
} from '@potenova/persistence';

const dirs: string[] = [];
async function freshDir(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), 'potenova-all-'));
  dirs.push(d);
  return d;
}
afterAll(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
});

describe('whole-system persistence on one shared database (ADR-0002/0017)', () => {
  it('every store survives a restart', async () => {
    const dir = await freshDir();

    // --- write across all stores, then close the database ---
    const db1 = openDatabase(dir);
    await new IdentityRepository(db1).saveFamily({
      familyId: 'fam-1',
      marketRegion: 'ca-on',
      legalOwnerGuardianId: 'g-1',
      status: 'active',
    });
    await new IdentityRepository(db1).saveConsentGrant({
      grantId: 'cg-1',
      familyId: 'fam-1',
      purpose: 'core_learning',
      version: 'v1',
      modality: 'text',
      state: 'GIVEN',
      grantedAt: '2026-10-10T00:00:00Z',
      revokedAt: null,
    });
    await new BillingRepository(db1).saveEntitlement({
      familyId: 'fam-1',
      state: 'TRIAL_ACTIVE',
      tierId: null,
      updatedAt: '2026-10-10T00:00:00Z',
    });
    await new ContentRepository(db1).saveAsset({
      assetId: 'asset-1',
      assetVersion: 'v1',
      state: 'APPROVED_FOR_USE',
      provenance: 'ai_generated',
      subject: 'math',
      ageBand: 'junior',
      producedBy: 'model-1',
      curriculumReleaseId: 'REL-ONT-MATH-2020-draft',
    });
    await new ContentRepository(db1).quarantine({
      assetId: 'asset-bad',
      assetVersion: 'v1',
      reasonCode: 'WRONG_KEY',
      actor: 'reviewer-1',
      at: '2026-10-10T00:00:00Z',
      regressionCaseId: 'RC-0001-asset-bad',
    });
    await new SafetyRepository(db1).recordAudit({
      approver: 'system',
      reason: 'role not permitted',
      object: 'child_conversations',
      action: 'privileged_elevation',
      outcome: 'DENIED',
      expiry: null,
      at: '2026-10-10T00:00:00Z',
    });
    await new OperatorRepository(db1).setKillSwitch({
      capability: 'free_form_tutor',
      disabled: true,
      actor: 'op-1',
      reason: 'jailbreak spike',
      at: '2026-10-10T00:00:00Z',
    });
    await new SessionRepository(db1).saveTutoringSession({
      sessionId: 'sess-1',
      learnerAlias: 'lnr-1',
      subject: 'math',
      state: 'ACTIVE',
    });
    await new CurriculumRepository(db1).saveSkill({
      skillId: 'SK-FR-compare',
      domain: 'math',
      competency: 'number:fractions',
      skill: 'Compare two fractions',
      subskill: null,
      version: 'frac-draft-0.1',
      status: 'active',
    });
    await db1.close();

    // --- reopen (restart) and confirm everything is still there ---
    const db2 = openDatabase(dir);
    expect((await new IdentityRepository(db2).getFamily('fam-1'))?.status).toBe('active');
    expect(await new IdentityRepository(db2).listConsentGrants('fam-1')).toHaveLength(1);
    expect((await new BillingRepository(db2).getEntitlement('fam-1'))?.state).toBe('TRIAL_ACTIVE');
    expect((await new ContentRepository(db2).getAsset('asset-1'))?.state).toBe('APPROVED_FOR_USE');
    expect(await new ContentRepository(db2).isQuarantined('asset-bad')).toBe(true);
    expect(await new SafetyRepository(db2).recentAudit()).toHaveLength(1);
    // SAFE-012: the disabled capability is STILL disabled after the restart
    expect(await new OperatorRepository(db2).isCapabilityActive('free_form_tutor')).toBe(false);
    expect((await new SessionRepository(db2).getTutoringSession('sess-1'))?.state).toBe('ACTIVE');
    expect(await new CurriculumRepository(db2).listSkills()).toHaveLength(1);
    await db2.close();
  });

  it('idempotency is durable across a restart (no double grant, at-most-once submit)', async () => {
    const dir = await freshDir();

    const db1 = openDatabase(dir);
    const billing1 = new BillingRepository(db1);
    expect(
      (
        await billing1.recordCallback({
          channel: 'apple',
          transactionId: 't1',
          familyId: 'fam-1',
          kind: 'grant',
          at: 't',
        })
      ).applied,
    ).toBe(true);
    await new SessionRepository(db1).recordSubmission('sub-1', 't');
    await db1.close();

    // reopen and replay the SAME callback + submission — must be refused as duplicates
    const db2 = openDatabase(dir);
    const dup = await new BillingRepository(db2).recordCallback({
      channel: 'apple',
      transactionId: 't1',
      familyId: 'fam-1',
      kind: 'grant',
      at: 't2',
    });
    expect(dup).toEqual({ applied: false, duplicate: true });
    expect((await new SessionRepository(db2).recordSubmission('sub-1', 't2')).accepted).toBe(false);
    await db2.close();
  });
});
