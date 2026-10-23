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
 *  DRAFT — Math strand: data interpretation (data & probability)
 * ============================================================================
 * Ontario Grade 1 Data (read and interpret data in a simple graph — the
 * rule-decidable slice: which category has the most/fewest). Coached through the
 * SELECTION interaction, graded by a deterministic oracle that recomputes the
 * extreme category.
 *   SK-DATA-interpret-graph   pick the most/fewest category from a graph
 *
 * The first Data skill in the engine. Authored as data in
 * `strands/data/data-handling.json` and loaded by the shared loader. DRAFT
 * ENGINEERING FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const DATA = strand('data-handling');

export const DATA_SKILLS: readonly CanonicalSkill[] = DATA.skills;
export const DATA_DEPENDENCIES: readonly SkillDependency[] = DATA.dependencies;
export const DATA_STRATEGIES: readonly InstructionalStrategy[] = DATA.strategies;
export const DATA_MISCONCEPTIONS: readonly MisconceptionDefinition[] = DATA.misconceptions;

export function buildDataHandlingDraftGraph(): CurriculumGraph {
  return strandGraph('data-handling');
}
