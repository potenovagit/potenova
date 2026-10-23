import type { CurriculumGraph } from './graph';
import type {
  CanonicalSkill,
  SkillDependency,
  MisconceptionDefinition,
  InstructionalStrategy,
} from './entities';
import { strand, strandGraph } from './strands';

/**
 * ============================================================================
 *  DRAFT — Math strand: estimation to 200 (Grade 2)
 * ============================================================================
 * Ontario Grade 2 B1.3 (rule-decidable slice — estimate the number in a
 * collection to 200, then verify by counting):
 *   SK-NS-estimate-200   estimate a larger collection within a reviewed band
 *
 * Reuses the deterministic estimate_within_band oracle unchanged — correctness
 * is membership in an educator-reviewed tolerance band around the true count,
 * so only the authored counts and bands grow (to 200). Authored as data in
 * `strands/data/estimation-g2.json`. DRAFT ENGINEERING FIXTURE, NOT VALIDATED
 * CURRICULUM COVERAGE (ER-03 gate).
 */

const EST = strand('estimation-g2');

export const ESTIMATION_G2_SKILLS: readonly CanonicalSkill[] = EST.skills;
export const ESTIMATION_G2_DEPENDENCIES: readonly SkillDependency[] = EST.dependencies;
export const ESTIMATION_G2_STRATEGIES: readonly InstructionalStrategy[] = EST.strategies;
export const ESTIMATION_G2_MISCONCEPTIONS: readonly MisconceptionDefinition[] = EST.misconceptions;

export function buildEstimationG2DraftGraph(): CurriculumGraph {
  return strandGraph('estimation-g2');
}
