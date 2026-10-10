import type { SkillState } from '@potenova/domain-core';
import {
  projectShadow,
  type MasteryEvidence,
  type EvidenceCorrectionRecord,
  type EvidenceMode,
  type SkillProjection,
  type MasteryPolicy,
} from '@potenova/learner-state';

/**
 * Baseline strand / prerequisite profile (DIA-002/003/004/005/008; AT-05).
 *
 * Mode boundary (DIA-004/005): only assessment-type observations count as
 * placement evidence. A coached 'teaching'-mode response — correct or not — is
 * never silently relabeled as independent placement evidence, so it is excluded
 * here before projection.
 *
 * No history => UNASSESSED with an explicit `unknown` standing (AT-05): never a
 * zero score and never a failure label.
 */

/** Evidence modes admissible as placement evidence (everything except coaching). */
export const PLACEMENT_MODES: ReadonlySet<EvidenceMode> = new Set<EvidenceMode>([
  'diagnostic',
  'independent_check',
  'retention_check',
  'transfer_check',
]);

export function placementEvidence(events: readonly MasteryEvidence[]): MasteryEvidence[] {
  return events.filter((e) => PLACEMENT_MODES.has(e.mode));
}

/** Parent-friendly standing (DIA-008): a plain label over the internal state. */
export type SkillStanding = 'unknown' | 'emerging' | 'developing' | 'demonstrated' | 'needs_review';

export function classifyStanding(p: SkillProjection): SkillStanding {
  switch (p.state) {
    case 'UNASSESSED':
      return 'unknown';
    case 'EMERGING':
      return 'emerging';
    case 'DEVELOPING':
      return 'developing';
    case 'INDEPENDENT':
    case 'RETAINED':
    case 'TRANSFERABLE':
      return 'demonstrated';
    case 'REVALIDATION_REQUIRED':
      return 'needs_review';
    default: {
      const _never: never = p.state;
      void _never;
      return 'unknown';
    }
  }
}

export interface SkillBaseline {
  readonly skillId: string;
  readonly state: SkillState;
  readonly standing: SkillStanding;
  readonly confidence: number;
  /** Dimensions still explicitly unknown (DIA-003) — presented, not guessed. */
  readonly unknownDimensions: readonly string[];
}

function unknownDimensions(p: SkillProjection): string[] {
  if (p.state === 'UNASSESSED') return ['independent', 'retained', 'transferable'];
  const out: string[] = [];
  if (!p.dimensions.independent) out.push('independent');
  if (!p.dimensions.retained) out.push('retained');
  if (!p.dimensions.transferable) out.push('transferable');
  return out;
}

export interface BaselineProfile {
  readonly learnerAlias: string;
  readonly skills: readonly SkillBaseline[];
  readonly policyVersion: string;
}

/**
 * Build a baseline over the target skills, reusing the learner's immutable
 * evidence (placement-admissible only). Pure — reads evidence, writes nothing.
 */
export function buildBaselineProfile(
  learnerAlias: string,
  targetSkillIds: readonly string[],
  allEvents: readonly MasteryEvidence[],
  corrections: readonly EvidenceCorrectionRecord[] = [],
  masteryPolicy?: MasteryPolicy,
): BaselineProfile {
  const placement = placementEvidence(allEvents);
  const projections = targetSkillIds.map((skillId) =>
    projectShadow(learnerAlias, skillId, placement, corrections, masteryPolicy),
  );
  const skills = projections.map(
    (p): SkillBaseline => ({
      skillId: p.skillId,
      state: p.state,
      standing: classifyStanding(p),
      confidence: p.confidence,
      unknownDimensions: unknownDimensions(p),
    }),
  );
  const policyVersion = projections[0]?.policyVersion ?? 'none';
  return { learnerAlias, skills, policyVersion };
}
