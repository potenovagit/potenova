import { CurriculumGraph } from './graph';
import type { CanonicalSkill, SkillDependency } from './entities';

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

export function buildEnglishDraftGraph(): CurriculumGraph {
  const g = new CurriculumGraph();
  for (const s of ENGLISH_SKILLS) g.addSkill(s);
  for (const d of ENGLISH_DEPENDENCIES) g.addDependency(d);
  return g;
}
