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
 *  DRAFT — Math strand: add/subtract fractions, unlike denominators (Grade 6)
 * ============================================================================
 * Ontario Grade 6 B2 / exp 10 (rule-decidable slice):
 *   SK-NS-fraction-addsub-unlike   add and subtract fractions with unlike
 *                                  denominators (value-graded)
 *
 * A DISTINCT kind from the Grade 5 like-denominator skill: this one REQUIRES
 * the two denominators to differ, so the G5 fail-closed guarantee (a single
 * shared denominator) is never widened. Authored as data in
 * `strands/data/fractions-g6.json`. DRAFT ENGINEERING FIXTURE, NOT VALIDATED
 * CURRICULUM COVERAGE (ER-03 gate).
 */

const FRAC = strand('fractions-g6');

export const FRACTIONS_G6_SKILLS: readonly CanonicalSkill[] = FRAC.skills;
export const FRACTIONS_G6_DEPENDENCIES: readonly SkillDependency[] = FRAC.dependencies;
export const FRACTIONS_G6_STRATEGIES: readonly InstructionalStrategy[] = FRAC.strategies;
export const FRACTIONS_G6_MISCONCEPTIONS: readonly MisconceptionDefinition[] = FRAC.misconceptions;

export function buildFractionsG6DraftGraph(): CurriculumGraph {
  return strandGraph('fractions-g6');
}
