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
 *  DRAFT — Math strand: even and odd (Grade 2, number sense)
 * ============================================================================
 * Ontario Grade 2 B1.5 (describe what makes a number even or odd). Decided by a
 * deterministic parity oracle.
 *   SK-NS-even-odd   decide whether a whole number is even or odd
 *
 * Authored as data in `strands/data/even-odd.json`. DRAFT ENGINEERING FIXTURE,
 * NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const EO = strand('even-odd');

export const EVEN_ODD_SKILLS: readonly CanonicalSkill[] = EO.skills;
export const EVEN_ODD_DEPENDENCIES: readonly SkillDependency[] = EO.dependencies;
export const EVEN_ODD_STRATEGIES: readonly InstructionalStrategy[] = EO.strategies;
export const EVEN_ODD_MISCONCEPTIONS: readonly MisconceptionDefinition[] = EO.misconceptions;

export function buildEvenOddDraftGraph(): CurriculumGraph {
  return strandGraph('even-odd');
}
