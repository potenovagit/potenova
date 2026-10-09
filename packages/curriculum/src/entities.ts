/**
 * Curriculum & Knowledge domain entities (WP-02).
 * Source: 03_Canonical_Domain_State_Machines.md §2; LRN-007/008; CUR domain.
 *
 * The canonical skill graph is stable across curriculum editions; curriculum
 * expectations are versioned and jurisdiction-specific and map to canonical
 * skills through review-controlled mappings. AI may PROPOSE relationships but
 * may never mutate the canonical graph (Master §12; TM-42/43) — enforced in
 * `CurriculumGraph`.
 */

/** Typed dependency edges (LRN-007). `from` is a prerequisite/support FOR `to`. */
export const DEPENDENCY_TYPES = ['hardPrerequisite', 'strong', 'supporting', 'transfer'] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

/** Approval status of a graph element. Candidates do not affect canonical traversal. */
export type ApprovalStatus = 'proposed' | 'approved';

export interface CanonicalSkill {
  readonly skillId: string;
  readonly domain: string; // e.g. 'math'
  readonly competency: string; // e.g. 'number:fractions'
  readonly skill: string; // human label
  readonly subskill?: string;
  readonly version: string;
  readonly status: 'active' | 'deprecated';
}

export interface SkillDependency {
  readonly dependencyId: string;
  readonly fromSkillId: string; // prerequisite/support
  readonly toSkillId: string; // dependent skill
  readonly type: DependencyType;
  readonly weight: number; // 0..1 relative strength
  readonly approvalStatus: ApprovalStatus;
  readonly approvalVersion: string | null; // set when approved
  readonly proposedBy?: string; // e.g. 'ai-candidate' (never auto-canonical)
}

export interface CurriculumRelease {
  readonly curriculumReleaseId: string;
  readonly jurisdiction: string; // 'ontario'
  readonly subject: string; // 'math'
  readonly gradeRange: string; // 'G1-8'
  readonly edition: string; // 'Ontario Math 2020'
  readonly validFrom: string;
  readonly status: 'draft' | 'published';
}

/**
 * Jurisdiction-specific expectation. `reviewStatus` MUST be 'reviewed' before an
 * expectation is treated as authoritative (CUR: human-reviewed before publication).
 * DRAFT fixtures carry 'draft' and MUST NOT be presented as validated coverage.
 */
export interface CurriculumExpectation {
  readonly expectationId: string;
  readonly curriculumReleaseId: string;
  readonly sourceCode: string; // official Ontario code — pulled + reviewed at WP-02 authoring
  readonly strand: string;
  readonly grade: number;
  readonly statementRef: string;
  readonly reviewStatus: 'draft' | 'reviewed';
}

export interface ExpectationSkillMap {
  readonly mappingId: string;
  readonly expectationId: string;
  readonly skillId: string;
  readonly strength: number;
  readonly coverage: 'full' | 'partial';
  readonly reviewedBy: string | null; // null until curriculum review signs it
  readonly version: string;
}

/** Misconception knowledge base (LRN-008) — error patterns, never clinical labels. */
export interface MisconceptionDefinition {
  readonly misconceptionId: string;
  readonly skillId: string;
  readonly pattern: string;
  readonly probeIds: readonly string[];
  readonly remediationStrategyIds: readonly string[];
  readonly version: string;
}

/** Instructional strategy (method, distinct from UI representation). */
export interface InstructionalStrategy {
  readonly strategyId: string;
  readonly intent: string;
  readonly approvedBands: readonly string[]; // F-08 bands: primary/junior/intermediate
  readonly representations: readonly string[];
  readonly version: string;
}
