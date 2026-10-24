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
 *  DRAFT — Math strand: fraction ↔ percent equivalence (Grade 5)
 * ============================================================================
 * Ontario Grade 5 B1 / exp 6 (rule-decidable slice — equivalences among
 * fractions, decimals and whole-number percents):
 *   SK-NS-fraction-percent-equiv   decide if a fraction equals a percent
 *
 * The first percent skill — extends the fraction↔decimal idea (a percent is
 * pct/100) with a new `fraction_percent_equiv` kind, graded by exact
 * cross-multiplication. Authored as data in `strands/data/percents-g5.json`.
 * DRAFT ENGINEERING FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const PCT = strand('percents-g5');

export const PERCENTS_G5_SKILLS: readonly CanonicalSkill[] = PCT.skills;
export const PERCENTS_G5_DEPENDENCIES: readonly SkillDependency[] = PCT.dependencies;
export const PERCENTS_G5_STRATEGIES: readonly InstructionalStrategy[] = PCT.strategies;
export const PERCENTS_G5_MISCONCEPTIONS: readonly MisconceptionDefinition[] = PCT.misconceptions;

export function buildPercentsG5DraftGraph(): CurriculumGraph {
  return strandGraph('percents-g5');
}
