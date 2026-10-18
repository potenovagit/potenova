import { EvidenceRepository, type PotenovaDb } from '@potenova/persistence';
import type { MasteryEvidence } from '@potenova/learner-state';

/**
 * Three representations → an INDEPENDENT (unaided, multi-representation) check.
 * Shared by the API journey/planner tests so a precondition skill can be marked
 * mastered without driving a full coaching loop for it.
 */
export const REPS = ['symbolic', 'area-model', 'number-line'] as const;

/**
 * Seed 3 unaided-correct observations across 3 representations for `skillId`,
 * all for learner `kid1` in `fam1`, at time `at` — enough for the derived
 * projection to read INDEPENDENT. Evidence is the sole mastery authority, so
 * this is the faithful way to say "the learner already has this skill".
 */
export async function seedMastered(
  db: PotenovaDb,
  skillId: string,
  at: string,
  tag: string,
  learnerAlias = 'kid1',
) {
  const repo = new EvidenceRepository(db);
  for (let i = 0; i < REPS.length; i++) {
    const ev: MasteryEvidence = {
      eventId: `seed-${tag}-${i}`,
      learnerAlias,
      skillId,
      mode: 'independent_check',
      assistanceBand: 'A0',
      correct: true,
      representation: REPS[i],
      recognitionConfidence: 1,
      observedAt: at,
      curriculumReleaseId: 'REL-ONT-MATH-2020-draft',
      schemaVersion: 'evt-0.1',
    };
    await repo.appendEvidence(ev);
  }
}
