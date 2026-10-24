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
 *  DRAFT — Math strand: GCF & LCM (Grade 7)
 * ============================================================================
 * Ontario Grade 7 B2 / exp B2.6:
 *   SK-NS-gcf-pair   greatest common factor of two whole numbers (≤144)
 *   SK-NS-lcm-pair   lowest common multiple of two whole numbers
 *
 * Both by exact integer arithmetic (Euclid; LCM = a/gcd·b), graded by value.
 * Authored as data in `strands/data/factors-g7.json`. DRAFT ENGINEERING
 * FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const FAC = strand('factors-g7');

export const FACTORS_G7_SKILLS: readonly CanonicalSkill[] = FAC.skills;
export const FACTORS_G7_DEPENDENCIES: readonly SkillDependency[] = FAC.dependencies;
export const FACTORS_G7_STRATEGIES: readonly InstructionalStrategy[] = FAC.strategies;
export const FACTORS_G7_MISCONCEPTIONS: readonly MisconceptionDefinition[] = FAC.misconceptions;

export function buildFactorsG7DraftGraph(): CurriculumGraph {
  return strandGraph('factors-g7');
}
