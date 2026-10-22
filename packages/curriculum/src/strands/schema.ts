import { CurriculumGraph } from '../graph';
import {
  DEPENDENCY_TYPES,
  type DependencyType,
  type CanonicalSkill,
  type SkillDependency,
  type MisconceptionDefinition,
  type InstructionalStrategy,
} from '../entities';

/**
 * Data-driven teachable-skill strand representation (WP-02; ADR-0023 extension).
 *
 * A strand's teachable skills, prerequisite edges, misconceptions and
 * instructional strategies are authored as DATA (a `StrandDataset`, shipped as a
 * JSON file under `./data`) and assembled into the domain entities by a single
 * loader. Adding or extending a strand is adding/editing a data file — no new
 * TypeScript — so the representation scales to the full Ontario G1–8 scope
 * without per-strand code.
 *
 * The data rows are compact: the loader stamps the cross-cutting fields the
 * hand-authored builders used to set inline (`version`, `status: 'active'`,
 * `approvalStatus`, `approvalVersion`) from the dataset, so a migrated strand
 * yields byte-identical entities. Edges are stamped `approved` because a strand
 * dataset is the reviewed DRAFT baseline for its slice — exactly as the previous
 * fixtures seeded them; an AI/candidate edge still goes through
 * `CurriculumGraph.proposeDependency` and never comes from here.
 *
 * This sets NO mastery thresholds, weights beyond the relative edge strength, or
 * benchmarks — those remain the educator's (ER-03/NFR-07/NFR-08). A dataset with
 * `reviewStatus: 'draft'` MUST NOT be presented as validated curriculum coverage.
 */

/** Compact skill row — the loader adds domain(from dataset)/version/status. */
export interface StrandSkillRow {
  readonly skillId: string;
  readonly competency: string;
  readonly skill: string;
  readonly subskill?: string;
}

/** Compact dependency row — the loader adds approvalStatus/approvalVersion. */
export interface StrandDependencyRow {
  readonly dependencyId: string;
  readonly fromSkillId: string;
  readonly toSkillId: string;
  readonly type: DependencyType;
  readonly weight: number;
}

/** Compact misconception row — the loader adds version. */
export interface StrandMisconceptionRow {
  readonly misconceptionId: string;
  readonly skillId: string;
  readonly pattern: string;
  readonly probeIds: readonly string[];
  readonly remediationStrategyIds: readonly string[];
}

/** Compact strategy row — the loader adds version. */
export interface StrandStrategyRow {
  readonly strategyId: string;
  readonly intent: string;
  readonly approvedBands: readonly string[];
  readonly representations: readonly string[];
}

/** One authored strand, as data. */
export interface StrandDataset {
  /** Stable strand key, e.g. 'fractions', 'addition', 'english-plurals'. */
  readonly strandId: string;
  /** Version stamped onto every entity the loader produces (e.g. 'frac-draft-0.1'). */
  readonly version: string;
  /** Skill domain, e.g. 'math' | 'english'. */
  readonly domain: string;
  /** 'draft' until an educator review signs the slice. Drafts are runnable
   *  fixtures, never validated coverage. */
  readonly reviewStatus: 'draft' | 'reviewed';
  readonly skills: readonly StrandSkillRow[];
  readonly dependencies: readonly StrandDependencyRow[];
  readonly misconceptions?: readonly StrandMisconceptionRow[];
  readonly strategies?: readonly StrandStrategyRow[];
}

/** A dataset assembled into domain entities, ready for the engine. */
export interface LoadedStrand {
  readonly strandId: string;
  readonly version: string;
  readonly domain: string;
  readonly reviewStatus: 'draft' | 'reviewed';
  readonly skills: readonly CanonicalSkill[];
  readonly dependencies: readonly SkillDependency[];
  readonly misconceptions: readonly MisconceptionDefinition[];
  readonly strategies: readonly InstructionalStrategy[];
}

const isFiniteWeight = (w: unknown): w is number =>
  typeof w === 'number' && Number.isFinite(w) && w >= 0 && w <= 1;

/**
 * Validate a strand dataset's internal consistency. Throws on any structural
 * problem so malformed data can never silently enter the engine. Pure; used at
 * load and by tests. It does NOT judge pedagogical correctness — that is the
 * educator's (ER-03). Checks: required header fields; unique ids; edges and
 * misconceptions reference known skills; edge type/weight valid; no self-edge;
 * misconception remediation references known strategies; and the resulting
 * prerequisite graph is acyclic.
 */
export function validateStrandData(d: StrandDataset): void {
  const where = `strand ${d.strandId || '(unnamed)'}`;
  if (!d.strandId) throw new Error(`${where}: missing strandId`);
  if (!d.version) throw new Error(`${where}: missing version`);
  if (!d.domain) throw new Error(`${where}: missing domain`);
  if (d.reviewStatus !== 'draft' && d.reviewStatus !== 'reviewed') {
    throw new Error(`${where}: reviewStatus must be 'draft' or 'reviewed'`);
  }
  if (!Array.isArray(d.skills) || d.skills.length === 0) {
    throw new Error(`${where}: at least one skill is required`);
  }

  const skillIds = new Set<string>();
  for (const s of d.skills) {
    if (!s.skillId) throw new Error(`${where}: a skill is missing skillId`);
    if (skillIds.has(s.skillId)) throw new Error(`${where}: duplicate skill ${s.skillId}`);
    skillIds.add(s.skillId);
    if (!s.competency || !s.skill) {
      throw new Error(`${where}: skill ${s.skillId} missing competency/label`);
    }
  }

  const strategyIds = new Set<string>();
  for (const st of d.strategies ?? []) {
    if (!st.strategyId) throw new Error(`${where}: a strategy is missing strategyId`);
    if (strategyIds.has(st.strategyId)) {
      throw new Error(`${where}: duplicate strategy ${st.strategyId}`);
    }
    strategyIds.add(st.strategyId);
  }

  const depIds = new Set<string>();
  for (const e of d.dependencies) {
    if (!e.dependencyId) throw new Error(`${where}: a dependency is missing dependencyId`);
    if (depIds.has(e.dependencyId))
      throw new Error(`${where}: duplicate dependency ${e.dependencyId}`);
    depIds.add(e.dependencyId);
    if (!skillIds.has(e.fromSkillId)) {
      throw new Error(`${where}: dependency ${e.dependencyId} from unknown skill ${e.fromSkillId}`);
    }
    if (!skillIds.has(e.toSkillId)) {
      throw new Error(`${where}: dependency ${e.dependencyId} to unknown skill ${e.toSkillId}`);
    }
    if (e.fromSkillId === e.toSkillId) {
      throw new Error(`${where}: dependency ${e.dependencyId} is a self-edge`);
    }
    if (!(DEPENDENCY_TYPES as readonly string[]).includes(e.type)) {
      throw new Error(`${where}: dependency ${e.dependencyId} has bad type ${e.type}`);
    }
    if (!isFiniteWeight(e.weight)) {
      throw new Error(`${where}: dependency ${e.dependencyId} weight must be in [0,1]`);
    }
  }

  const mcIds = new Set<string>();
  for (const m of d.misconceptions ?? []) {
    if (!m.misconceptionId) throw new Error(`${where}: a misconception is missing misconceptionId`);
    if (mcIds.has(m.misconceptionId)) {
      throw new Error(`${where}: duplicate misconception ${m.misconceptionId}`);
    }
    mcIds.add(m.misconceptionId);
    if (!skillIds.has(m.skillId)) {
      throw new Error(`${where}: misconception ${m.misconceptionId} on unknown skill ${m.skillId}`);
    }
    for (const sid of m.remediationStrategyIds) {
      if (!strategyIds.has(sid)) {
        throw new Error(
          `${where}: misconception ${m.misconceptionId} references unknown strategy ${sid}`,
        );
      }
    }
  }

  // The seeded (approved) prerequisite graph must be acyclic.
  if (buildStrandGraph(d).hasCycle()) {
    throw new Error(`${where}: prerequisite graph has a cycle`);
  }
}

/** Assemble a dataset into domain entities (stamping version/status/approval).
 *  Validates first unless `skipValidation` is set (the validator itself passes
 *  it to avoid infinite recursion through the acyclicity check). */
export function loadStrand(
  d: StrandDataset,
  opts: { skipValidation?: boolean } = {},
): LoadedStrand {
  if (!opts.skipValidation) validateStrandData(d);
  const skills: CanonicalSkill[] = d.skills.map((s) => ({
    skillId: s.skillId,
    domain: d.domain,
    competency: s.competency,
    skill: s.skill,
    ...(s.subskill ? { subskill: s.subskill } : {}),
    version: d.version,
    status: 'active',
  }));
  const dependencies: SkillDependency[] = d.dependencies.map((e) => ({
    dependencyId: e.dependencyId,
    fromSkillId: e.fromSkillId,
    toSkillId: e.toSkillId,
    type: e.type,
    weight: e.weight,
    approvalStatus: 'approved',
    approvalVersion: d.version,
  }));
  const misconceptions: MisconceptionDefinition[] = (d.misconceptions ?? []).map((m) => ({
    misconceptionId: m.misconceptionId,
    skillId: m.skillId,
    pattern: m.pattern,
    probeIds: [...m.probeIds],
    remediationStrategyIds: [...m.remediationStrategyIds],
    version: d.version,
  }));
  const strategies: InstructionalStrategy[] = (d.strategies ?? []).map((st) => ({
    strategyId: st.strategyId,
    intent: st.intent,
    approvedBands: [...st.approvedBands],
    representations: [...st.representations],
    version: d.version,
  }));
  return {
    strandId: d.strandId,
    version: d.version,
    domain: d.domain,
    reviewStatus: d.reviewStatus,
    skills,
    dependencies,
    misconceptions,
    strategies,
  };
}

/** Build a CurriculumGraph populated with a strand's skills and seeded (approved)
 *  prerequisite edges, straight from a dataset. */
export function buildStrandGraph(d: StrandDataset): CurriculumGraph {
  const loaded = loadStrand(d, { skipValidation: true });
  const g = new CurriculumGraph();
  for (const s of loaded.skills) g.addSkill(s);
  for (const e of loaded.dependencies) g.addDependency(e);
  return g;
}
