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
 *  DRAFT — Math strand: exponents / repeated multiplication (Grade 7)
 * ============================================================================
 * Ontario Grade 7 B2 / exp B2.7:
 *   SK-NS-power-eval   evaluate repeated multiplication written as a power
 *
 * base^exponent by exact repeated integer multiplication (no floats / Math.pow),
 * fail-closed over a safe-integer cap. Authored as data in
 * `strands/data/exponents-g7.json`. DRAFT ENGINEERING FIXTURE, NOT VALIDATED
 * CURRICULUM COVERAGE (ER-03 gate).
 */

const EXP = strand('exponents-g7');

export const EXPONENTS_G7_SKILLS: readonly CanonicalSkill[] = EXP.skills;
export const EXPONENTS_G7_DEPENDENCIES: readonly SkillDependency[] = EXP.dependencies;
export const EXPONENTS_G7_STRATEGIES: readonly InstructionalStrategy[] = EXP.strategies;
export const EXPONENTS_G7_MISCONCEPTIONS: readonly MisconceptionDefinition[] = EXP.misconceptions;

export function buildExponentsG7DraftGraph(): CurriculumGraph {
  return strandGraph('exponents-g7');
}
