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
 *  DRAFT — Math strand: whole-number addition (number sense)
 * ============================================================================
 * A second Math strand so the engine runs on more than one curriculum graph per
 * subject:
 *   SK-NS-add-within10   sums within 10 (no regrouping)         [entry]
 *   SK-NS-add-within20   sums within 20 (crossing ten)          [depends on within10]
 *
 * Authored as data in `strands/data/addition.json` and loaded by the shared
 * loader; the named exports are preserved for consumers. DRAFT ENGINEERING
 * FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const ADD = strand('addition');

export const ADDITION_SKILLS: readonly CanonicalSkill[] = ADD.skills;
export const ADDITION_DEPENDENCIES: readonly SkillDependency[] = ADD.dependencies;
export const ADDITION_STRATEGIES: readonly InstructionalStrategy[] = ADD.strategies;
export const ADDITION_MISCONCEPTIONS: readonly MisconceptionDefinition[] = ADD.misconceptions;

export function buildAdditionDraftGraph(): CurriculumGraph {
  return strandGraph('addition');
}
