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
 *  DRAFT — Math strand: estimation (number sense)
 * ============================================================================
 * Ontario Grade 1 B1.4 (estimate the number in a collection, then verify).
 * Coached through the ESTIMATION interaction: a correct answer is one inside an
 * educator-reviewed tolerance band around the true count — not a single value.
 *   SK-NS-estimate-50   estimate a collection to 50 within the reviewed band
 *
 * Authored as data in `strands/data/estimation.json` and loaded by the shared
 * loader. DRAFT ENGINEERING FIXTURE, NOT VALIDATED CURRICULUM COVERAGE
 * (ER-03 gate); the tolerance bands are placeholders for educator-set values.
 */

const EST = strand('estimation');

export const ESTIMATION_SKILLS: readonly CanonicalSkill[] = EST.skills;
export const ESTIMATION_DEPENDENCIES: readonly SkillDependency[] = EST.dependencies;
export const ESTIMATION_STRATEGIES: readonly InstructionalStrategy[] = EST.strategies;
export const ESTIMATION_MISCONCEPTIONS: readonly MisconceptionDefinition[] = EST.misconceptions;

export function buildEstimationDraftGraph(): CurriculumGraph {
  return strandGraph('estimation');
}
