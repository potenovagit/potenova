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
 *  DRAFT — Math strand: build a number (number sense, construction)
 * ============================================================================
 * Ontario Grade 1 B1.1/B1.2 (represent and compose/decompose numbers flexibly
 * with materials). Coached through the CONSTRUCTION interaction: the learner
 * builds a target from tens and ones, and ANY valid decomposition is accepted —
 * the oracle checks the built value against the goal.
 *   SK-NS-build-number   build a whole number to 50 from tens and ones
 *
 * Authored as data in `strands/data/construction.json` and loaded by the shared
 * loader. DRAFT ENGINEERING FIXTURE, NOT VALIDATED CURRICULUM COVERAGE
 * (ER-03 gate).
 */

const BUILD = strand('construction');

export const CONSTRUCTION_SKILLS: readonly CanonicalSkill[] = BUILD.skills;
export const CONSTRUCTION_DEPENDENCIES: readonly SkillDependency[] = BUILD.dependencies;
export const CONSTRUCTION_STRATEGIES: readonly InstructionalStrategy[] = BUILD.strategies;
export const CONSTRUCTION_MISCONCEPTIONS: readonly MisconceptionDefinition[] = BUILD.misconceptions;

export function buildConstructionDraftGraph(): CurriculumGraph {
  return strandGraph('construction');
}
