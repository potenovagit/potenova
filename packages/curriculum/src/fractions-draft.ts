import type { CurriculumGraph } from './graph';
import type {
  CanonicalSkill,
  SkillDependency,
  MisconceptionDefinition,
  InstructionalStrategy,
  CurriculumRelease,
  CurriculumExpectation,
  ExpectationSkillMap,
} from './entities';
import { strand, strandGraph } from './strands';

/**
 * ============================================================================
 *  DRAFT — G1 vertical-slice strand: Fractions (F-09, accepted 2026-10-09)
 * ============================================================================
 * Scope: unit fractions -> equivalence -> comparison (Ontario Grades 3-5), with
 * Grade 2-3 equal-partitioning as the prerequisite entry. Chosen to exercise the
 * dependency graph, misconception KB, multiple representations and the AT-08
 * remediation loop end-to-end.
 *
 * The teachable skills, prerequisite edges, misconceptions and strategies now
 * live in `strands/data/fractions.json` and are assembled by the shared loader
 * (ADR-0023 extension — curriculum is data-driven, scalable to G1–8). The
 * named exports below are preserved so every consumer (overlay, adaptive) is
 * unchanged; they are the loaded strand's entities.
 *
 * THIS IS A DRAFT ENGINEERING FIXTURE, NOT VALIDATED CURRICULUM COVERAGE.
 *  - `sourceCode` values in the expectation mapping are placeholders; the real
 *    Ontario Math 2020 codes are HUMAN-REVIEWED at WP-02 authoring (the
 *    curriculum gate). Nothing here is signed.
 *  - `reviewStatus: 'draft'` / `reviewedBy: null` mark this as unverified.
 */

const FR = strand('fractions');
const V = FR.version;

export const FRACTION_SKILLS: readonly CanonicalSkill[] = FR.skills;
export const FRACTION_DEPENDENCIES: readonly SkillDependency[] = FR.dependencies;
export const FRACTION_MISCONCEPTIONS: readonly MisconceptionDefinition[] = FR.misconceptions;
export const FRACTION_STRATEGIES: readonly InstructionalStrategy[] = FR.strategies;

/** DRAFT curriculum release + unverified expectation mapping (placeholders). */
export const FRACTION_RELEASE: CurriculumRelease = {
  curriculumReleaseId: 'REL-ONT-MATH-2020-draft',
  jurisdiction: 'ontario',
  subject: 'math',
  gradeRange: 'G3-5',
  edition: 'Ontario Math 2020',
  validFrom: '2026-10-09',
  status: 'draft',
};

export const FRACTION_EXPECTATIONS: readonly CurriculumExpectation[] = FRACTION_SKILLS.map(
  (s, i) => ({
    expectationId: `EXP-FR-draft-${i + 1}`,
    curriculumReleaseId: FRACTION_RELEASE.curriculumReleaseId,
    sourceCode: 'DRAFT-PENDING-CURRICULUM-REVIEW', // real Ontario code set at WP-02 authoring
    strand: 'Number',
    grade: i <= 1 ? 3 : i <= 4 ? 4 : 5,
    statementRef: s.skill,
    reviewStatus: 'draft',
  }),
);

export const FRACTION_MAPPINGS: readonly ExpectationSkillMap[] = FRACTION_SKILLS.map((s, i) => ({
  mappingId: `MAP-FR-draft-${i + 1}`,
  expectationId: `EXP-FR-draft-${i + 1}`,
  skillId: s.skillId,
  strength: 1.0,
  coverage: 'partial',
  reviewedBy: null, // unsigned until curriculum review
  version: V,
}));

/** Build a graph populated with the DRAFT fractions strand. */
export function buildFractionsDraftGraph(): CurriculumGraph {
  return strandGraph('fractions');
}
