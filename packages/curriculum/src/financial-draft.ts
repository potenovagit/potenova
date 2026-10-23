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
 *  DRAFT — Math strand: money value (financial literacy)
 * ============================================================================
 * Ontario Grade 1 F1.1 (rule-decidable slice — total the value of Canadian
 * coins and bills to $50):
 *   SK-FIN-coin-value   add up the value of a set of money pieces
 *
 * The first Financial Literacy skill in the engine. Authored as data in
 * `strands/data/financial.json` and loaded by the shared loader; the named
 * exports are preserved for consumers. DRAFT ENGINEERING FIXTURE, NOT VALIDATED
 * CURRICULUM COVERAGE (ER-03 gate).
 */

const FIN = strand('financial');

export const FINANCIAL_SKILLS: readonly CanonicalSkill[] = FIN.skills;
export const FINANCIAL_DEPENDENCIES: readonly SkillDependency[] = FIN.dependencies;
export const FINANCIAL_STRATEGIES: readonly InstructionalStrategy[] = FIN.strategies;
export const FINANCIAL_MISCONCEPTIONS: readonly MisconceptionDefinition[] = FIN.misconceptions;

export function buildFinancialDraftGraph(): CurriculumGraph {
  return strandGraph('financial');
}
