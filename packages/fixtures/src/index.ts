import type { EvidenceEvent } from '@potenova/domain-core';

/**
 * Synthetic fixture generation.
 * Source: CLAUDE.md non-negotiable ("Use synthetic data for development and
 * testing"); SEC-002; AI-003; AT-51. WP-00 exit: "synthetic fixture strategy".
 *
 * ALL data here is deterministically generated and explicitly marked synthetic.
 * There is NO code path that ingests production/child data. The SYNTHETIC_MARKER
 * is asserted in tests and should be checked by any loader before use.
 */

export const SYNTHETIC_MARKER = 'SYNTHETIC::POTENOVA-FIXTURE' as const;

/** Tiny deterministic PRNG (mulberry32) so fixtures are reproducible in CI. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SyntheticLearner {
  readonly marker: typeof SYNTHETIC_MARKER;
  readonly learnerAlias: string;
  readonly ageBand: 'primary' | 'junior' | 'intermediate'; // F-08 Ontario divisions
  readonly grade: number;
}

export interface SyntheticFamily {
  readonly marker: typeof SYNTHETIC_MARKER;
  readonly familyAlias: string;
  readonly marketRegion: 'ca-on';
  readonly learners: readonly SyntheticLearner[];
}

const SKILLS = ['SK-math-count-01', 'SK-math-add-01', 'SK-math-frac-01', 'SK-eng-decode-01'];

/** Mirror of identity's F-08 mapping (fixtures stay dependency-light). */
function bandForGrade(grade: number): SyntheticLearner['ageBand'] {
  if (grade <= 3) return 'primary';
  if (grade <= 6) return 'junior';
  return 'intermediate';
}

export function makeFamily(seed: number, learnerCount = 2): SyntheticFamily {
  const r = rng(seed);
  const learners: SyntheticLearner[] = [];
  for (let i = 0; i < learnerCount; i++) {
    const grade = 1 + Math.floor(r() * 8); // Ontario G1-8
    learners.push({
      marker: SYNTHETIC_MARKER,
      learnerAlias: `syn-learner-${seed}-${i}`,
      ageBand: bandForGrade(grade),
      grade,
    });
  }
  return {
    marker: SYNTHETIC_MARKER,
    familyAlias: `syn-family-${seed}`,
    marketRegion: 'ca-on',
    learners,
  };
}

export function makeEvidenceEvents(learnerAlias: string, seed: number, n = 5): EvidenceEvent[] {
  const r = rng(seed);
  const bands = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'] as const;
  return Array.from({ length: n }, (_, i) => ({
    eventId: `syn-ev-${seed}-${i}`,
    learnerAlias,
    skillId: SKILLS[Math.floor(r() * SKILLS.length)] ?? 'SK-math-add-01',
    assistanceBand: bands[Math.floor(r() * bands.length)] ?? 'A0',
    recognitionConfidence: Number((0.6 + r() * 0.4).toFixed(2)),
    schemaVersion: 'evidence-1',
  }));
}
