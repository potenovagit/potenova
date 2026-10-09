import { CurriculumGraph } from './graph';
import type {
  CanonicalSkill,
  SkillDependency,
  MisconceptionDefinition,
  InstructionalStrategy,
  CurriculumRelease,
  CurriculumExpectation,
  ExpectationSkillMap,
} from './entities';

/**
 * ============================================================================
 *  DRAFT — G1 vertical-slice strand: Fractions (F-09, accepted 2026-10-09)
 * ============================================================================
 * Scope: unit fractions -> equivalence -> comparison (Ontario Grades 3-5), with
 * Grade 2-3 equal-partitioning as the prerequisite entry. Chosen to exercise the
 * dependency graph, misconception KB, multiple representations and the AT-08
 * remediation loop end-to-end.
 *
 * THIS IS A DRAFT ENGINEERING FIXTURE, NOT VALIDATED CURRICULUM COVERAGE.
 *  - `sourceCode` values are placeholders. The real Ontario Math 2020 expectation
 *    codes are pulled from the official curriculum and HUMAN-REVIEWED during WP-02
 *    authoring (the curriculum gate). Nothing here is signed.
 *  - `reviewStatus: 'draft'` and `reviewedBy: null` mark this as unverified.
 * It exists so the graph machinery and diagnostic have real structure to run on.
 */

const V = 'frac-draft-0.1';

const skill = (
  skillId: string,
  competency: string,
  label: string,
  subskill?: string,
): CanonicalSkill => ({
  skillId,
  domain: 'math',
  competency,
  skill: label,
  ...(subskill ? { subskill } : {}),
  version: V,
  status: 'active',
});

export const FRACTION_SKILLS: readonly CanonicalSkill[] = [
  skill('SK-FR-partition', 'number:fractions', 'Partition a whole into equal parts'),
  skill('SK-FR-unit', 'number:fractions', 'Name unit fractions (1/2, 1/3, 1/4)'),
  skill(
    'SK-FR-nonunit',
    'number:fractions',
    'Build non-unit fractions as counts of unit fractions',
  ),
  skill('SK-FR-numberline', 'number:fractions', 'Place fractions on a number line'),
  skill('SK-FR-equiv', 'number:fractions', 'Recognize equivalent fractions'),
  skill('SK-FR-compare', 'number:fractions', 'Compare two fractions'),
  skill('SK-FR-order', 'number:fractions', 'Order fractions in context'),
];

const edge = (
  id: string,
  from: string,
  to: string,
  type: SkillDependency['type'],
  weight: number,
): SkillDependency => ({
  dependencyId: id,
  fromSkillId: from,
  toSkillId: to,
  type,
  weight,
  approvalStatus: 'approved', // seeded as the reviewed DRAFT baseline for the slice
  approvalVersion: V,
});

export const FRACTION_DEPENDENCIES: readonly SkillDependency[] = [
  edge('D-fr-1', 'SK-FR-partition', 'SK-FR-unit', 'hardPrerequisite', 1.0),
  edge('D-fr-2', 'SK-FR-unit', 'SK-FR-nonunit', 'hardPrerequisite', 0.9),
  edge('D-fr-3', 'SK-FR-unit', 'SK-FR-equiv', 'strong', 0.7),
  edge('D-fr-4', 'SK-FR-nonunit', 'SK-FR-equiv', 'strong', 0.8),
  edge('D-fr-5', 'SK-FR-nonunit', 'SK-FR-compare', 'strong', 0.7),
  edge('D-fr-6', 'SK-FR-equiv', 'SK-FR-compare', 'strong', 0.8),
  edge('D-fr-7', 'SK-FR-numberline', 'SK-FR-compare', 'supporting', 0.5),
  edge('D-fr-8', 'SK-FR-compare', 'SK-FR-order', 'transfer', 0.6),
];

export const FRACTION_MISCONCEPTIONS: readonly MisconceptionDefinition[] = [
  {
    misconceptionId: 'MC-FR-denom-size',
    skillId: 'SK-FR-compare',
    pattern: 'Treats a larger denominator as a larger fraction (1/8 > 1/4).',
    probeIds: ['PR-FR-compare-unit'],
    remediationStrategyIds: ['ST-area-model', 'ST-number-line'],
    version: V,
  },
  {
    misconceptionId: 'MC-FR-independent-whole',
    skillId: 'SK-FR-nonunit',
    pattern: 'Treats numerator and denominator as independent whole numbers.',
    probeIds: ['PR-FR-build-nonunit'],
    remediationStrategyIds: ['ST-area-model'],
    version: V,
  },
  {
    misconceptionId: 'MC-FR-unequal-parts',
    skillId: 'SK-FR-partition',
    pattern: 'Counts unequal parts as if they were equal fractional parts.',
    probeIds: ['PR-FR-equal-parts'],
    remediationStrategyIds: ['ST-area-model'],
    version: V,
  },
];

export const FRACTION_STRATEGIES: readonly InstructionalStrategy[] = [
  {
    strategyId: 'ST-area-model',
    intent: 'Represent fractions as equal areas of a whole.',
    approvedBands: ['primary', 'junior'],
    representations: ['area-model'],
    version: V,
  },
  {
    strategyId: 'ST-number-line',
    intent: 'Locate fractions as points between 0 and 1.',
    approvedBands: ['junior'],
    representations: ['number-line'],
    version: V,
  },
];

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
  const g = new CurriculumGraph();
  for (const s of FRACTION_SKILLS) g.addSkill(s);
  for (const d of FRACTION_DEPENDENCIES) g.addDependency(d);
  return g;
}
