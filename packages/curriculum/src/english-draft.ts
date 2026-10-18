import { CurriculumGraph } from './graph';
import type {
  CanonicalSkill,
  SkillDependency,
  MisconceptionDefinition,
  InstructionalStrategy,
} from './entities';

/**
 * ============================================================================
 *  DRAFT — English vertical-slice strand: Regular noun plurals
 * ============================================================================
 * Scope: a minimal second subject so the engine (content gate, evidence,
 * planner, stall, mastery) is exercised on something other than Math. Two
 * rule-decidable skills with a prerequisite edge, so the SAME adaptive
 * remediation → advancement loop runs for English:
 *   SK-EN-plural-base      add -s (dog→dogs)                    [entry]
 *   SK-EN-plural-sibilant  -es / consonant-y→ies (box→boxes)    [depends on base]
 *
 * THIS IS A DRAFT ENGINEERING FIXTURE, NOT VALIDATED CURRICULUM COVERAGE.
 *  - Not mapped to official Language curriculum expectations; HUMAN-REVIEWED
 *    authoring (the curriculum gate, ER-03) signs real coverage. Nothing here is
 *    signed; `status: 'active'` marks the fixture as runnable, not approved.
 */

const V = 'eng-draft-0.1';

const skill = (skillId: string, label: string): CanonicalSkill => ({
  skillId,
  domain: 'english',
  competency: 'language:morphology',
  skill: label,
  version: V,
  status: 'active',
});

export const ENGLISH_SKILLS: readonly CanonicalSkill[] = [
  skill('SK-EN-plural-base', 'Form regular plurals by adding -s'),
  skill('SK-EN-plural-sibilant', 'Form plurals with -es and consonant-y → -ies'),
  skill('SK-EN-past-regular', 'Form the regular simple past (-ed, with doubling / drop-e / y→ied)'),
  skill('SK-EN-comparative', 'Form the regular comparative (-er, with doubling / drop-e / y→ier)'),
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
  approvalStatus: 'approved', // seeded as the reviewed DRAFT baseline for the slice
  approvalVersion: V,
});

export const ENGLISH_DEPENDENCIES: readonly SkillDependency[] = [
  edge('D-en-1', 'SK-EN-plural-base', 'SK-EN-plural-sibilant', 'hardPrerequisite', 1.0),
];

export const ENGLISH_STRATEGIES: readonly InstructionalStrategy[] = [
  {
    strategyId: 'ST-en-say-aloud',
    intent: 'Say the word aloud — if the ending hisses (s, x, z, ch, sh), add -es, not just -s.',
    approvedBands: ['primary', 'junior'],
    representations: ['spoken'],
    version: V,
  },
  {
    strategyId: 'ST-en-ending-pattern',
    intent: 'Check the last letters: -es after s/x/z/ch/sh, and consonant + y becomes -ies.',
    approvedBands: ['junior'],
    representations: ['written'],
    version: V,
  },
];

export const ENGLISH_MISCONCEPTIONS: readonly MisconceptionDefinition[] = [
  {
    misconceptionId: 'MC-EN-sibilant-bare-s',
    skillId: 'SK-EN-plural-sibilant',
    pattern: 'Adds a bare -s after a sibilant (writes "boxs" instead of "boxes").',
    probeIds: ['PR-EN-sibilant'],
    remediationStrategyIds: ['ST-en-say-aloud', 'ST-en-ending-pattern'],
    version: V,
  },
];

export function buildEnglishDraftGraph(): CurriculumGraph {
  const g = new CurriculumGraph();
  for (const s of ENGLISH_SKILLS) g.addSkill(s);
  for (const d of ENGLISH_DEPENDENCIES) g.addDependency(d);
  return g;
}
