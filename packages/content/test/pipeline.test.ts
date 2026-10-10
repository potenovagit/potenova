import { describe, it, expect } from 'vitest';
import {
  produceAndDeliver,
  selectReusableAsset,
  QuarantineRegistry,
  type ValidationInput,
  type SelectableAsset,
} from '@potenova/content';

const clean = (over: Partial<ValidationInput> = {}): ValidationInput => ({
  candidateId: 'cand-1',
  generatorId: 'model-generator-1',
  validatorId: 'validator-independent-1',
  validatorVersion: 'val-DRAFT-0.1',
  math: { ran: true, correct: true },
  safety: { available: true, pass: true },
  onTopic: true,
  ...over,
});

const fallback = { assetId: 'approved-fallback-1' };

describe('generate->validate->deliver pipeline (AI §7, AT-20/39)', () => {
  it('a validated candidate is DELIVERed with its signed record', () => {
    const res = produceAndDeliver(clean(), fallback);
    expect(res.verdict).toBe('PASS');
    expect(res.outcome).toEqual({ kind: 'DELIVER', candidateId: 'cand-1' });
  });

  it('AT-20: a wrong-key candidate is blocked and the approved fallback is served', () => {
    const res = produceAndDeliver(clean({ math: { ran: true, correct: false } }), fallback);
    expect(res.verdict).toBe('FAIL');
    expect(res.outcome).toEqual({ kind: 'FALLBACK', assetId: 'approved-fallback-1' });
  });

  it('AT-39: validator outage with no fallback BLOCKs as VALIDATION_UNAVAILABLE', () => {
    const res = produceAndDeliver(clean({ safety: { available: false, pass: null } }), null);
    expect(res.verdict).toBe('UNAVAILABLE');
    expect(res.outcome).toEqual({ kind: 'BLOCK', reason: 'VALIDATION_UNAVAILABLE' });
  });

  it('a safety FAIL with no fallback BLOCKs as SAFETY_BLOCKED (never the candidate)', () => {
    const res = produceAndDeliver(clean({ safety: { available: true, pass: false } }), null);
    expect(res.outcome).toEqual({ kind: 'BLOCK', reason: 'SAFETY_BLOCKED' });
  });
});

describe('reuse-first selection respects lifecycle + quarantine (CONT-005/007, AT-49)', () => {
  const pool: SelectableAsset[] = [
    { assetId: 'a-generated', state: 'GENERATED', objectiveSkillIds: ['SK-FR-compare'] },
    { assetId: 'a-approved', state: 'APPROVED_FOR_USE', objectiveSkillIds: ['SK-FR-compare'] },
  ];

  it('prefers an approved, non-quarantined asset for the objective skill', () => {
    const q = new QuarantineRegistry();
    const picked = selectReusableAsset(pool, 'SK-FR-compare', (id) => q.isQuarantined(id));
    expect(picked?.assetId).toBe('a-approved');
  });

  it('never selects a GENERATED (non-deliverable) asset', () => {
    const q = new QuarantineRegistry();
    const picked = selectReusableAsset(
      [{ assetId: 'a-generated', state: 'GENERATED', objectiveSkillIds: ['SK-FR-unit'] }],
      'SK-FR-unit',
      (id) => q.isQuarantined(id),
    );
    expect(picked).toBeNull();
  });

  it('AT-49: once quarantined, an approved asset is no longer selectable', () => {
    const q = new QuarantineRegistry();
    q.quarantine({
      assetId: 'a-approved',
      assetVersion: 'v1',
      reasonCode: 'CHALLENGE_UPHELD',
      actor: 'operator-1',
    });
    const picked = selectReusableAsset(pool, 'SK-FR-compare', (id) => q.isQuarantined(id));
    expect(picked).toBeNull(); // approved one is excluded; generated one is non-deliverable
  });
});
