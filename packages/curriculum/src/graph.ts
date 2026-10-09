import { DomainError } from '@potenova/contracts';
import type { CanonicalSkill, SkillDependency, DependencyType } from './entities';

/**
 * Review-controlled canonical skill graph (WP-02).
 * Source: LRN-007; Master §12 (AI may propose, not alter canonical); TM-42/43;
 * AT-08 (prerequisite traversal), AT-50 (versioned, history-preserving).
 *
 * Canonical traversal considers ONLY approved edges. A proposed (e.g.
 * AI-candidate) edge is held until an authorised reviewer approves it, so an
 * unreviewed proposal can never change a learner's prerequisite path.
 */

/** Edge types that constitute a prerequisite path for traversal. */
const PREREQUISITE_TYPES: ReadonlySet<DependencyType> = new Set<DependencyType>([
  'hardPrerequisite',
  'strong',
]);

export class CurriculumGraph {
  readonly #skills = new Map<string, CanonicalSkill>();
  readonly #deps = new Map<string, SkillDependency>();

  addSkill(skill: CanonicalSkill): void {
    this.#skills.set(skill.skillId, skill);
  }

  getSkill(skillId: string): CanonicalSkill {
    const s = this.#skills.get(skillId);
    if (!s) throw new DomainError('NOT_FOUND', 'skill not found');
    return s;
  }

  skillCount(): number {
    return this.#skills.size;
  }

  /** Add a dependency with an explicit approval status (seed path). */
  addDependency(dep: SkillDependency): void {
    if (!this.#skills.has(dep.fromSkillId) || !this.#skills.has(dep.toSkillId)) {
      throw new DomainError('NOT_FOUND', 'dependency references an unknown skill');
    }
    this.#deps.set(dep.dependencyId, dep);
  }

  /** AI/candidate proposal path — always lands as 'proposed', never canonical. */
  proposeDependency(dep: Omit<SkillDependency, 'approvalStatus' | 'approvalVersion'>): void {
    this.addDependency({ ...dep, approvalStatus: 'proposed', approvalVersion: null });
  }

  /** Review-controlled promotion of a proposed edge to canonical. */
  approveDependency(dependencyId: string, reviewer: string, approvalVersion: string): void {
    const dep = this.#deps.get(dependencyId);
    if (!dep) throw new DomainError('NOT_FOUND', 'dependency not found');
    if (!reviewer) throw new DomainError('REVIEW_REQUIRED', 'reviewer required to approve');
    this.#deps.set(dependencyId, { ...dep, approvalStatus: 'approved', approvalVersion });
  }

  /** Direct prerequisites of a skill (approved prerequisite-type edges only). */
  directPrerequisites(skillId: string): readonly string[] {
    return [...this.#deps.values()]
      .filter(
        (d) =>
          d.toSkillId === skillId &&
          d.approvalStatus === 'approved' &&
          PREREQUISITE_TYPES.has(d.type),
      )
      .map((d) => d.fromSkillId);
  }

  /** Transitive prerequisite closure (approved edges), cycle-safe. */
  prerequisiteClosure(skillId: string): readonly string[] {
    const seen = new Set<string>();
    const stack = [...this.directPrerequisites(skillId)];
    while (stack.length > 0) {
      const id = stack.pop() as string;
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...this.directPrerequisites(id));
    }
    return [...seen];
  }

  /**
   * Integrity check: the approved prerequisite graph must be acyclic
   * (a skill cannot transitively require itself). Used by review/CI.
   */
  hasCycle(): boolean {
    const WHITE = 0,
      GREY = 1,
      BLACK = 2;
    const colour = new Map<string, number>();
    const visit = (id: string): boolean => {
      colour.set(id, GREY);
      for (const pre of this.directPrerequisites(id)) {
        const c = colour.get(pre) ?? WHITE;
        if (c === GREY) return true;
        if (c === WHITE && visit(pre)) return true;
      }
      colour.set(id, BLACK);
      return false;
    };
    for (const id of this.#skills.keys()) {
      if ((colour.get(id) ?? WHITE) === WHITE && visit(id)) return true;
    }
    return false;
  }
}
