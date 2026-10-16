import { CurriculumGraph } from './graph';
import type {
  CanonicalSkill,
  SkillDependency,
  MisconceptionDefinition,
  InstructionalStrategy,
} from './entities';

/**
 * ============================================================================
 *  DRAFT — Math strand: whole-number addition (number sense)
 * ============================================================================
 * A second Math strand so the engine runs on more than one curriculum graph per
 * subject. Two rule-decidable skills with a prerequisite edge:
 *   SK-NS-add-within10   sums within 10 (no regrouping)         [entry]
 *   SK-NS-add-within20   sums within 20 (crossing ten)          [depends on within10]
 *
 * DRAFT ENGINEERING FIXTURE, NOT VALIDATED CURRICULUM COVERAGE (ER-03 gate).
 */

const V = 'add-draft-0.1';

const skill = (skillId: string, label: string): CanonicalSkill => ({
  skillId,
  domain: 'math',
  competency: 'number:addition',
  skill: label,
  version: V,
  status: 'active',
});

export const ADDITION_SKILLS: readonly CanonicalSkill[] = [
  skill('SK-NS-add-within10', 'Add whole numbers within 10'),
  skill('SK-NS-add-within20', 'Add whole numbers within 20 (crossing ten)'),
];

const edge = (
  id: string,
  from: string,
  to: string,
  type: SkillDependency['type'],
  weight: number,
): SkillDependency => ({
  dependencyId: id,
  fromSkillId: from,
  toSkillId: to,
  type,
  weight,
  approvalStatus: 'approved',
  approvalVersion: V,
});

export const ADDITION_DEPENDENCIES: readonly SkillDependency[] = [
  edge('D-ns-1', 'SK-NS-add-within10', 'SK-NS-add-within20', 'hardPrerequisite', 1.0),
];

export const ADDITION_STRATEGIES: readonly InstructionalStrategy[] = [
  {
    strategyId: 'ST-ns-make-ten',
    intent: 'Make a ten first, then add what is left (e.g. 8 + 5 → 8 + 2 + 3).',
    approvedBands: ['primary'],
    representations: ['number-line', 'counters'],
    version: V,
  },
];

export const ADDITION_MISCONCEPTIONS: readonly MisconceptionDefinition[] = [
  {
    misconceptionId: 'MC-NS-no-regroup',
    skillId: 'SK-NS-add-within20',
    pattern: 'Does not carry when the ones exceed ten (e.g. 8 + 5 → 13 becomes "3").',
    probeIds: ['PR-NS-cross-ten'],
    remediationStrategyIds: ['ST-ns-make-ten'],
    version: V,
  },
];

export function buildAdditionDraftGraph(): CurriculumGraph {
  const g = new CurriculumGraph();
  for (const s of ADDITION_SKILLS) g.addSkill(s);
  for (const d of ADDITION_DEPENDENCIES) g.addDependency(d);
  return g;
}
