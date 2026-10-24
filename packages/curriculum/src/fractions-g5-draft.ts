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
 *  DRAFT — Math strand: add/subtract fractions, like denominators (Grade 5)
 * ============================================================================
 * Ontario Grade 5 B2 / exp 11 (rule-decidable slice — add and subtract fractions
 * with like denominators):
 *   SK-NS-fraction-addsub-like   p/d ± q/d = (p ± q)/d
 *
 * Reuses the fraction value-equality idea from the existing fraction oracles —
 * a new `fraction_addsub_like` kind grades the learner's fraction answer by
 * value (cross-multiply), so an equivalent form is accepted. No model. Authored
 * as data in `strands/data/fractions-g5.json`. DRAFT ENGINEERING FIXTURE, NOT
 * VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const FR = strand('fractions-g5');

export const FRACTIONS_G5_SKILLS: readonly CanonicalSkill[] = FR.skills;
export const FRACTIONS_G5_DEPENDENCIES: readonly SkillDependency[] = FR.dependencies;
export const FRACTIONS_G5_STRATEGIES: readonly InstructionalStrategy[] = FR.strategies;
export const FRACTIONS_G5_MISCONCEPTIONS: readonly MisconceptionDefinition[] = FR.misconceptions;

export function buildFractionsG5DraftGraph(): CurriculumGraph {
  return strandGraph('fractions-g5');
}
