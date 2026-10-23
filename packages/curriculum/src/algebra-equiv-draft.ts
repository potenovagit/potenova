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
 *  DRAFT — Math strand: expression equivalence (algebra)
 * ============================================================================
 * Ontario Grade 1 C2.2 (determine whether two addition/subtraction expressions
 * are equal):
 *   SK-AL-equiv-expr   decide if two simple expressions have the same value
 *
 * The first Algebra skill in the engine. Authored as data in
 * `strands/data/algebra-equiv.json` and loaded by the shared loader; the named
 * exports are preserved for consumers. DRAFT ENGINEERING FIXTURE, NOT VALIDATED
 * CURRICULUM COVERAGE (ER-03 gate).
 */

const ALG = strand('algebra-equiv');

export const ALGEBRA_EQUIV_SKILLS: readonly CanonicalSkill[] = ALG.skills;
export const ALGEBRA_EQUIV_DEPENDENCIES: readonly SkillDependency[] = ALG.dependencies;
export const ALGEBRA_EQUIV_STRATEGIES: readonly InstructionalStrategy[] = ALG.strategies;
export const ALGEBRA_EQUIV_MISCONCEPTIONS: readonly MisconceptionDefinition[] = ALG.misconceptions;

export function buildAlgebraEquivDraftGraph(): CurriculumGraph {
  return strandGraph('algebra-equiv');
}
