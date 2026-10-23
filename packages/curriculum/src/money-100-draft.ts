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
 *  DRAFT — Math strand: money value to $100 (financial literacy, Grade 2)
 * ============================================================================
 * Ontario Grade 2 F1.1 (rule-decidable slice — total the value of Canadian
 * coins and bills to $100):
 *   SK-FIN-money-100   add up the value of a larger mixed set of money pieces
 *
 * Reuses the deterministic coin_value oracle with the item bound raised to
 * 10000¢ ($100); no engine change beyond that per-item cap. Authored as data in
 * `strands/data/money-100.json` and loaded by the shared loader. DRAFT
 * ENGINEERING FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const MONEY = strand('money-100');

export const MONEY_100_SKILLS: readonly CanonicalSkill[] = MONEY.skills;
export const MONEY_100_DEPENDENCIES: readonly SkillDependency[] = MONEY.dependencies;
export const MONEY_100_STRATEGIES: readonly InstructionalStrategy[] = MONEY.strategies;
export const MONEY_100_MISCONCEPTIONS: readonly MisconceptionDefinition[] = MONEY.misconceptions;

export function buildMoney100DraftGraph(): CurriculumGraph {
  return strandGraph('money-100');
}
