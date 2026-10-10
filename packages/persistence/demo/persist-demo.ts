import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { openEvidenceRepository } from '../src/index';

/**
 * Persistence demo — run it, then run it again.
 *
 *   npm run demo:persist
 *
 * Each run appends one evidence row to a real on-disk PostgreSQL (PGlite) database
 * under packages/persistence/.data/demo and prints the running total. The count
 * keeps growing across separate runs because the data is saved to disk — the same
 * way it will behave against managed PostgreSQL in production.
 */
const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', '.data', 'demo');
mkdirSync(dataDir, { recursive: true });

const repo = openEvidenceRepository(dataDir);
const before = await repo.countEvidence();

const eventId = `demo-${Date.now()}`;
await repo.appendEvidence({
  eventId,
  learnerAlias: 'demo-learner',
  skillId: 'SK-FR-compare',
  mode: 'independent_check',
  assistanceBand: 'A0',
  correct: true,
  representation: 'area-model',
  recognitionConfidence: 1,
  observedAt: new Date().toISOString(),
  curriculumReleaseId: 'REL-ONT-MATH-2020-draft',
  schemaVersion: 'evt-0.1',
});

const after = await repo.countEvidence();
await repo.close();

console.log(`\n  data dir:   ${dataDir}`);
console.log(`  rows before this run: ${before}`);
console.log(`  appended:             ${eventId}`);
console.log(`  rows now:             ${after}`);
console.log(`\n  Run it again — the total keeps climbing, because it is saved to disk.\n`);
