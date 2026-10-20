import { describe, it, expect, afterEach } from 'vitest';
import { openDatabase, IdentityRepository, type PotenovaDb } from '@potenova/persistence';

/**
 * Persisted guardian↔IdP-subject directory (ADR-0035): a subject hash maps to a
 * family/guardian, the link is created once (idempotent first-writer-wins), and
 * an unknown subject resolves to null.
 */

let dbs: PotenovaDb[] = [];
afterEach(async () => {
  await Promise.all(dbs.map((d) => d.close()));
  dbs = [];
});
const open = () => {
  const db = openDatabase();
  dbs.push(db);
  return new IdentityRepository(db);
};

describe('idp-subject directory', () => {
  it('links a subject and resolves it back', async () => {
    const repo = open();
    expect(await repo.getGuardianBySubject('hash-a')).toBeNull();

    await repo.linkIdpSubject({
      subjectHash: 'hash-a',
      guardianId: 'gdn-1',
      familyId: 'fam-1',
      linkedAt: '2026-10-19T00:00:00Z',
    });
    expect(await repo.getGuardianBySubject('hash-a')).toEqual({
      guardianId: 'gdn-1',
      familyId: 'fam-1',
    });
  });

  it('is first-writer-wins — a second link for the same subject is a no-op', async () => {
    const repo = open();
    await repo.linkIdpSubject({
      subjectHash: 'h',
      guardianId: 'gdn-1',
      familyId: 'fam-1',
      linkedAt: 't1',
    });
    await repo.linkIdpSubject({
      subjectHash: 'h',
      guardianId: 'gdn-2',
      familyId: 'fam-2',
      linkedAt: 't2',
    });
    expect(await repo.getGuardianBySubject('h')).toEqual({
      guardianId: 'gdn-1',
      familyId: 'fam-1',
    });
  });

  it('distinct subjects map to distinct guardians', async () => {
    const repo = open();
    await repo.linkIdpSubject({
      subjectHash: 'h1',
      guardianId: 'gdn-1',
      familyId: 'fam-1',
      linkedAt: 't',
    });
    await repo.linkIdpSubject({
      subjectHash: 'h2',
      guardianId: 'gdn-2',
      familyId: 'fam-2',
      linkedAt: 't',
    });
    expect((await repo.getGuardianBySubject('h1'))?.guardianId).toBe('gdn-1');
    expect((await repo.getGuardianBySubject('h2'))?.guardianId).toBe('gdn-2');
  });
});
