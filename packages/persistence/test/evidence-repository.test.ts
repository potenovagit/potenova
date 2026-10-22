import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openEvidenceRepository } from '@potenova/persistence';
import { projectShadow, type MasteryEvidence } from '@potenova/learner-state';

const ev = (
  eventId: string,
  representation: string,
  over: Partial<MasteryEvidence> = {},
): MasteryEvidence => ({
  eventId,
  learnerAlias: 'lnr-alias',
  skillId: 'SK-FR-compare',
  mode: 'independent_check',
  assistanceBand: 'A0',
  correct: true,
  representation,
  recognitionConfidence: 1,
  observedAt: '2026-10-10T00:00:00Z',
  curriculumReleaseId: 'REL-ONT-MATH-2020-draft',
  schemaVersion: 'evt-0.1',
  ...over,
});

const tmpDirs: string[] = [];
async function freshDir(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), 'potenova-pg-'));
  tmpDirs.push(d);
  return d;
}
afterAll(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

describe('evidence persistence (WP-03 · ADR-0002/0017)', () => {
  it('evidence written to disk survives a restart (new repository instance, same dir)', async () => {
    const dir = await freshDir();

    const repo1 = openEvidenceRepository(dir);
    await repo1.appendEvidence(ev('e1', 'area-model'));
    await repo1.appendEvidence(ev('e2', 'number-line'));
    await repo1.appendEvidence(ev('e3', 'symbolic'));
    expect(await repo1.countEvidence()).toBe(3);
    await repo1.close();

    // reopen — simulates a process/server restart
    const repo2 = openEvidenceRepository(dir);
    const events = await repo2.listEvidence('lnr-alias', 'SK-FR-compare');
    expect(events).toHaveLength(3);

    // the persisted evidence rebuilds the same mastery projection
    const corrections = await repo2.listCorrections(events.map((e) => e.eventId));
    const projection = projectShadow('lnr-alias', 'SK-FR-compare', events, corrections);
    expect(projection.state).toBe('INDEPENDENT');
    await repo2.close();
  });

  it('is append-only: re-ingesting the same event id is an idempotent no-op', async () => {
    const repo = openEvidenceRepository(await freshDir());
    await repo.appendEvidence(ev('dup', 'area-model'));
    await repo.appendEvidence(ev('dup', 'area-model', { correct: false })); // same id, different payload
    expect(await repo.countEvidence()).toBe(1);
    const [stored] = await repo.listEvidence('lnr-alias', 'SK-FR-compare');
    expect(stored!.correct).toBe(true); // original row is never overwritten
    await repo.close();
  });

  it('round-trips the conceptual fields (ER-03) and survives a restart', async () => {
    const dir = await freshDir();
    const repo1 = openEvidenceRepository(dir);
    await repo1.appendEvidence(
      ev('conc-1', 'area-model', {
        evidenceDimension: 'reasoning',
        itemFamilyId: 'fam-eq-A',
        gradeTarget: 3,
        sessionId: 's-1',
      }),
    );
    // a plain (non-conceptual) event leaves the new columns null
    await repo1.appendEvidence(ev('plain-1', 'symbolic'));
    await repo1.close();

    const repo2 = openEvidenceRepository(dir);
    const events = await repo2.listEvidence('lnr-alias', 'SK-FR-compare');
    const conc = events.find((e) => e.eventId === 'conc-1')!;
    expect(conc.evidenceDimension).toBe('reasoning');
    expect(conc.itemFamilyId).toBe('fam-eq-A');
    expect(conc.gradeTarget).toBe(3);
    expect(conc.sessionId).toBe('s-1');

    // null columns normalise back to absent, not null — so the conceptual
    // projection filter (evidenceDimension !== undefined) excludes them.
    const plain = events.find((e) => e.eventId === 'plain-1')!;
    expect(plain.evidenceDimension).toBeUndefined();
    expect(plain.itemFamilyId).toBeUndefined();
    expect(plain.gradeTarget).toBeUndefined();
    expect(plain.sessionId).toBeUndefined();
    expect('evidenceDimension' in plain).toBe(false);
    await repo2.close();
  });

  it('a persisted correction retracts an observation on replay (AT-25 lineage)', async () => {
    const dir = await freshDir();
    const repo1 = openEvidenceRepository(dir);
    await repo1.appendEvidence(ev('e1', 'area-model'));
    await repo1.appendEvidence(ev('e2', 'number-line'));
    await repo1.appendEvidence(ev('e3', 'symbolic'));
    await repo1.appendCorrection({
      correctionId: 'c1',
      targetEventId: 'e3',
      reason: 'disputed marking upheld',
      retract: true,
      createdAt: '2026-10-10T01:00:00Z',
    });
    await repo1.close();

    const repo2 = openEvidenceRepository(dir);
    const events = await repo2.listEvidence('lnr-alias', 'SK-FR-compare');
    const corrections = await repo2.listCorrections(events.map((e) => e.eventId));
    expect(corrections).toHaveLength(1);
    // with e3 retracted, only 2 unaided reps remain — below the INDEPENDENT gate
    const projection = projectShadow('lnr-alias', 'SK-FR-compare', events, corrections);
    expect(projection.state).not.toBe('INDEPENDENT');
    await repo2.close();
  });
});
