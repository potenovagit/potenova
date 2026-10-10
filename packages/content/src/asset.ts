import { DomainError } from '@potenova/contracts';

/**
 * ContentAsset lifecycle — canonical state machine (Architecture §3.4; CONT-001..007;
 * TM-09/TM-10/TM-40; AT-20/AT-21/AT-39/AT-49).
 *
 *   GENERATED -> VALIDATION_PENDING -> VALIDATED -> APPROVED_FOR_USE
 *             -> CANDIDATE_FOR_REUSE -> REVIEWED_REUSABLE
 *
 * Approved reference content may instead travel a controlled human path:
 *   HUMAN_AUTHORED -> REVIEWED -> APPROVED_FOR_USE
 *
 * LOCKED invariants:
 *  - Any pre-delivery failure -> QUARANTINED (terminal for this version; a versioned
 *    change is a NEW asset that must be revalidated — never an in-place un-quarantine).
 *  - Forbidden: GENERATED / VALIDATION_PENDING / QUARANTINED served to a child.
 *  - Forbidden: unreviewed automatic permanent library promotion.
 */

export const ASSET_STATES = [
  'GENERATED',
  'VALIDATION_PENDING',
  'VALIDATED',
  'APPROVED_FOR_USE',
  'CANDIDATE_FOR_REUSE',
  'REVIEWED_REUSABLE',
  'HUMAN_AUTHORED',
  'REVIEWED',
  'QUARANTINED',
] as const;
export type AssetState = (typeof ASSET_STATES)[number];

export type Provenance = 'ai_generated' | 'human_authored';
export type AgeBand = 'primary' | 'junior' | 'intermediate';
export type Subject = 'math' | 'english';

export interface ContentAsset {
  readonly assetId: string;
  /** CONT-006: every asset/validator/rubric/outcome is versioned for investigation. */
  readonly assetVersion: string;
  readonly objectiveSkillIds: readonly string[];
  readonly ageBand: AgeBand;
  readonly subject: Subject;
  readonly provenance: Provenance;
  readonly state: AssetState;
  /** Model id (ai_generated) or human author id (human_authored). */
  readonly producedBy: string;
  readonly curriculumReleaseId: string;
  readonly schemaVersion: string;
}

/** The ONLY states from which an asset may reach a child. */
const DELIVERABLE_STATES: ReadonlySet<AssetState> = new Set<AssetState>([
  'APPROVED_FOR_USE',
  'REVIEWED_REUSABLE',
]);

export function isDeliverableState(state: AssetState): boolean {
  return DELIVERABLE_STATES.has(state);
}

/** Allowed forward transitions. Every state can fail-close to QUARANTINED. */
const TRANSITIONS: Readonly<Record<AssetState, readonly AssetState[]>> = {
  GENERATED: ['VALIDATION_PENDING', 'QUARANTINED'],
  VALIDATION_PENDING: ['VALIDATED', 'QUARANTINED'],
  VALIDATED: ['APPROVED_FOR_USE', 'QUARANTINED'],
  APPROVED_FOR_USE: ['CANDIDATE_FOR_REUSE', 'QUARANTINED'],
  CANDIDATE_FOR_REUSE: ['REVIEWED_REUSABLE', 'QUARANTINED'],
  REVIEWED_REUSABLE: ['QUARANTINED'],
  HUMAN_AUTHORED: ['REVIEWED', 'QUARANTINED'],
  REVIEWED: ['APPROVED_FOR_USE', 'QUARANTINED'],
  QUARANTINED: [], // terminal — a versioned change starts a new asset
};

export function canTransition(from: AssetState, to: AssetState): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Apply a lifecycle transition, returning a new asset.
 *
 * @throws DomainError POLICY_BLOCKED — illegal transition (incl. any attempt to
 *         revive a QUARANTINED asset or skip the validation path).
 */
export function transition(asset: ContentAsset, to: AssetState): ContentAsset {
  if (!canTransition(asset.state, to)) {
    throw new DomainError(
      'POLICY_BLOCKED',
      `illegal content lifecycle transition ${asset.state} -> ${to}`,
    );
  }
  return { ...asset, state: to };
}
