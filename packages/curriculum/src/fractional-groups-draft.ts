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
 *  DRAFT — Math strand: fractional groups (Grade 3)
 * ============================================================================
 * Ontario Grade 3 exp 13 (rule-decidable slice — problems involving groups of
 * one half, one third and one fourth):
 *   SK-FR-groups   count the unit-fraction pieces in a number of wholes
 *
 * The one G3 fraction expectation the existing seven fraction oracles do not
 * cover. Kept as its own single-skill strand so the established `fractions`
 * strand and its DRAFT graph stay untouched; a curriculum review (ER-03) may
 * later fold SK-FR-groups into the fractions graph. The count is computed by the
 * deterministic `fractional_groups` oracle and graded without a model. Authored
 * as data in `strands/data/fractional-groups.json`. DRAFT ENGINEERING FIXTURE,
 * NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const FG = strand('fractional-groups');

export const FRACTIONAL_GROUPS_SKILLS: readonly CanonicalSkill[] = FG.skills;
export const FRACTIONAL_GROUPS_DEPENDENCIES: readonly SkillDependency[] = FG.dependencies;
export const FRACTIONAL_GROUPS_STRATEGIES: readonly InstructionalStrategy[] = FG.strategies;
export const FRACTIONAL_GROUPS_MISCONCEPTIONS: readonly MisconceptionDefinition[] =
  FG.misconceptions;

export function buildFractionalGroupsDraftGraph(): CurriculumGraph {
  return strandGraph('fractional-groups');
}
