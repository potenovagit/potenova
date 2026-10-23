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
 *  DRAFT — Math strand: expression equivalence over +, −, ×, ÷ (Grade 3)
 * ============================================================================
 * Ontario Grade 3 B2.2 / exp 21 (rule-decidable slice — determine whether sets
 * of addition, subtraction, multiplication and division expressions are
 * equivalent):
 *   SK-AL-equiv-expr-muldiv   decide if two four-operation expressions are equal
 *
 * Rides a DISTINCT `expr_equivalence_muldiv` oracle kind — the Grade 1
 * `expr_equivalence` oracle (+/− only) is left byte-identical, so its "+/− only"
 * fail-closed contract is untouched. Authored as data in
 * `strands/data/algebra-equiv-g3.json`. DRAFT ENGINEERING FIXTURE, NOT VALIDATED
 * CURRICULUM COVERAGE (ER-03 gate).
 */

const ALG = strand('algebra-equiv-g3');

export const ALGEBRA_EQUIV_G3_SKILLS: readonly CanonicalSkill[] = ALG.skills;
export const ALGEBRA_EQUIV_G3_DEPENDENCIES: readonly SkillDependency[] = ALG.dependencies;
export const ALGEBRA_EQUIV_G3_STRATEGIES: readonly InstructionalStrategy[] = ALG.strategies;
export const ALGEBRA_EQUIV_G3_MISCONCEPTIONS: readonly MisconceptionDefinition[] =
  ALG.misconceptions;

export function buildAlgebraEquivG3DraftGraph(): CurriculumGraph {
  return strandGraph('algebra-equiv-g3');
}
