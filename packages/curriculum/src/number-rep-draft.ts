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
 *  DRAFT — Math strand: represent whole numbers to 50 (number sense)
 * ============================================================================
 * Ontario Grade 1 B1.1 (read and represent whole numbers to 50). Unlike the
 * computation strands, this skill is coached through the SELECTION interaction
 * ("which one shows 23?") — the first richer, non-type-the-answer task type —
 * graded by a deterministic selection oracle that recomputes the correct choice.
 *   SK-NS-represent-50   pick the base-ten representation of a given number
 *
 * Authored as data in `strands/data/number-rep.json` and loaded by the shared
 * loader; the named exports are preserved for consumers. DRAFT ENGINEERING
 * FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const NREP = strand('number-rep');

export const NUMBER_REP_SKILLS: readonly CanonicalSkill[] = NREP.skills;
export const NUMBER_REP_DEPENDENCIES: readonly SkillDependency[] = NREP.dependencies;
export const NUMBER_REP_STRATEGIES: readonly InstructionalStrategy[] = NREP.strategies;
export const NUMBER_REP_MISCONCEPTIONS: readonly MisconceptionDefinition[] = NREP.misconceptions;

export function buildNumberRepDraftGraph(): CurriculumGraph {
  return strandGraph('number-rep');
}
