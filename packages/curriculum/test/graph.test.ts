import { describe, it, expect } from 'vitest';
import { CurriculumGraph, type CanonicalSkill } from '@potenova/curriculum';
import { isDomainError } from '@potenova/contracts';

const sk = (id: string): CanonicalSkill => ({
  skillId: id,
  domain: 'math',
  competency: 'test',
  skill: id,
  version: 'v1',
  status: 'active',
});

describe('curriculum graph — review control + traversal (LRN-007, TM-42/43, AT-08)', () => {
  it('rejects a dependency that references an unknown skill', () => {
    const g = new CurriculumGraph();
    g.addSkill(sk('A'));
    try {
      g.addDependency({
        dependencyId: 'd1',
        fromSkillId: 'A',
        toSkillId: 'MISSING',
        type: 'hardPrerequisite',
        weight: 1,
        approvalStatus: 'approved',
        approvalVersion: 'v1',
      });
      throw new Error('expected NOT_FOUND');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('NOT_FOUND');
    }
  });

  it('a PROPOSED (AI-candidate) edge does not change canonical prerequisites until approved', () => {
    const g = new CurriculumGraph();
    g.addSkill(sk('A'));
    g.addSkill(sk('B'));
    // AI proposes "A is a prerequisite of B"
    g.proposeDependency({
      dependencyId: 'd1',
      fromSkillId: 'A',
      toSkillId: 'B',
      type: 'hardPrerequisite',
      weight: 1,
      proposedBy: 'ai-candidate',
    });
    expect(g.directPrerequisites('B')).toEqual([]); // not canonical yet (TM-42/43)

    g.approveDependency('d1', 'curriculum-reviewer', 'v1');
    expect(g.directPrerequisites('B')).toEqual(['A']); // now canonical
  });

  it('approval requires a reviewer', () => {
    const g = new CurriculumGraph();
    g.addSkill(sk('A'));
    g.addSkill(sk('B'));
    g.proposeDependency({
      dependencyId: 'd1',
      fromSkillId: 'A',
      toSkillId: 'B',
      type: 'strong',
      weight: 1,
    });
    try {
      g.approveDependency('d1', '', 'v1');
      throw new Error('expected REVIEW_REQUIRED');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('REVIEW_REQUIRED');
    }
  });

  it('detects a cycle in the approved prerequisite graph (integrity check)', () => {
    const g = new CurriculumGraph();
    g.addSkill(sk('A'));
    g.addSkill(sk('B'));
    const e = (id: string, from: string, to: string) =>
      g.addDependency({
        dependencyId: id,
        fromSkillId: from,
        toSkillId: to,
        type: 'hardPrerequisite' as const,
        weight: 1,
        approvalStatus: 'approved' as const,
        approvalVersion: 'v1',
      });
    e('d1', 'A', 'B');
    expect(g.hasCycle()).toBe(false);
    e('d2', 'B', 'A'); // introduce a back-edge
    expect(g.hasCycle()).toBe(true);
  });
});
