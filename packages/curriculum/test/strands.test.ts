import { describe, it, expect } from 'vitest';
import {
  STRAND_DATASETS,
  STRANDS,
  strand,
  strandGraph,
  loadStrand,
  validateStrandData,
  buildStrandGraph,
  type StrandDataset,
} from '@potenova/curriculum';

/**
 * The data-driven strand representation (ADR-0023 extension): the shared loader
 * validates datasets and assembles them into the same domain entities the
 * hand-authored fixtures used to produce, and malformed data fails closed.
 */

// A minimal valid dataset used as the base for negative mutations.
const base: StrandDataset = {
  strandId: 'test-strand',
  version: 'test-0.1',
  domain: 'math',
  reviewStatus: 'draft',
  skills: [
    { skillId: 'A', competency: 'number:test', skill: 'Skill A' },
    { skillId: 'B', competency: 'number:test', skill: 'Skill B' },
  ],
  dependencies: [
    { dependencyId: 'D1', fromSkillId: 'A', toSkillId: 'B', type: 'hardPrerequisite', weight: 1 },
  ],
  strategies: [
    {
      strategyId: 'ST-1',
      intent: 'do a thing',
      approvedBands: ['primary'],
      representations: ['area-model'],
    },
  ],
  misconceptions: [
    {
      misconceptionId: 'MC-1',
      skillId: 'B',
      pattern: 'a pattern',
      probeIds: ['PR-1'],
      remediationStrategyIds: ['ST-1'],
    },
  ],
};

describe('strand loader + validator', () => {
  it('loads a dataset into stamped domain entities', () => {
    const loaded = loadStrand(base);
    expect(loaded.skills).toHaveLength(2);
    expect(loaded.skills[0]).toMatchObject({
      skillId: 'A',
      domain: 'math',
      version: 'test-0.1',
      status: 'active',
    });
    expect(loaded.dependencies[0]).toMatchObject({
      dependencyId: 'D1',
      approvalStatus: 'approved',
      approvalVersion: 'test-0.1',
    });
    expect(loaded.misconceptions[0]!.version).toBe('test-0.1');
    expect(loaded.strategies[0]!.version).toBe('test-0.1');
  });

  it('builds an acyclic prerequisite graph with the expected closure', () => {
    const g = buildStrandGraph(base);
    expect(g.skillCount()).toBe(2);
    expect(g.hasCycle()).toBe(false);
    expect(g.prerequisiteClosure('B')).toEqual(['A']);
  });

  const reject = (mutate: (d: StrandDataset) => StrandDataset, re: RegExp) =>
    expect(() => validateStrandData(mutate(base))).toThrow(re);

  it('rejects an edge referencing an unknown skill', () => {
    reject(
      (d) => ({ ...d, dependencies: [{ ...d.dependencies[0]!, fromSkillId: 'NOPE' }] }),
      /unknown skill NOPE/,
    );
  });

  it('rejects a self-edge', () => {
    reject(
      (d) => ({ ...d, dependencies: [{ ...d.dependencies[0]!, toSkillId: 'A' }] }),
      /self-edge/,
    );
  });

  it('rejects a duplicate skill id', () => {
    reject((d) => ({ ...d, skills: [...d.skills, d.skills[0]!] }), /duplicate skill A/);
  });

  it('rejects a bad dependency type', () => {
    reject(
      (d) => ({
        ...d,
        dependencies: [{ ...d.dependencies[0]!, type: 'wishful' as never }],
      }),
      /bad type/,
    );
  });

  it('rejects an out-of-range weight', () => {
    reject((d) => ({ ...d, dependencies: [{ ...d.dependencies[0]!, weight: 2 }] }), /weight/);
  });

  it('rejects a misconception referencing an unknown strategy', () => {
    reject(
      (d) => ({
        ...d,
        misconceptions: [{ ...d.misconceptions![0]!, remediationStrategyIds: ['ST-ghost'] }],
      }),
      /unknown strategy ST-ghost/,
    );
  });

  it('rejects a cyclic prerequisite graph', () => {
    reject(
      (d) => ({
        ...d,
        dependencies: [
          ...d.dependencies,
          { dependencyId: 'D2', fromSkillId: 'B', toSkillId: 'A', type: 'strong', weight: 1 },
        ],
      }),
      /cycle/,
    );
  });

  it('rejects an empty skill set', () => {
    reject((d) => ({ ...d, skills: [] }), /at least one skill/);
  });
});

describe('strand registry (the authored strands)', () => {
  it('loads every shipped strand and validates it', () => {
    expect(STRAND_DATASETS.length).toBeGreaterThanOrEqual(3);
    for (const d of STRAND_DATASETS) {
      expect(() => validateStrandData(d)).not.toThrow();
      expect(STRANDS.has(d.strandId)).toBe(true);
    }
  });

  it('exposes fractions / addition / english with the expected entry skills', () => {
    expect(strand('fractions').skills.map((s) => s.skillId)).toContain('SK-FR-equiv');
    expect(strand('addition').skills.map((s) => s.skillId)).toContain('SK-NS-add-within10');
    expect(strand('english').skills.map((s) => s.skillId)).toContain('SK-EN-plural-base');
  });

  it('every shipped strand graph is acyclic', () => {
    for (const d of STRAND_DATASETS) {
      expect(strandGraph(d.strandId).hasCycle()).toBe(false);
    }
  });

  it('fractions keeps its canonical prerequisite path (partition → unit → … → compare)', () => {
    const closure = strandGraph('fractions').prerequisiteClosure('SK-FR-compare');
    expect(closure).toContain('SK-FR-equiv');
    expect(closure).toContain('SK-FR-unit');
    expect(closure).toContain('SK-FR-partition');
  });

  it('throws on an unknown strand id (fail fast)', () => {
    expect(() => strand('nope')).toThrow(/unknown strand/);
    expect(() => strandGraph('nope')).toThrow(/unknown strand/);
  });
});
