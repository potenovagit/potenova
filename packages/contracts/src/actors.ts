/**
 * Actor context carried on every command/query (common contract envelope).
 * Source: 04_Logical_Contracts_Events_Sequences.md — "Common contract envelope".
 *
 * `ActorType` is the basis of domain-boundary authorization. In particular it is
 * how the Learner-State authority enforces the LOCKED invariant that tutor/parent/
 * billing may NOT write mastery (Master §4; TM-07/TM-08; AT-56).
 */
export const ACTOR_TYPES = [
  'guardian', // authenticated parent/guardian (parent-only surfaces)
  'child', // least-privileged learner session
  'tutor_engine', // adaptive tutoring/session planner — submits evidence only
  'billing_service', // entitlement lifecycle — never touches learning history
  'learner_state_projector', // SOLE authority that advances LearnerSkillState
  'evidence_producer', // signed, trusted producer that appends EvidenceEvents
  'content_validator', // independent pre-delivery validation
  'ai_gateway', // model routing / provider abstraction
  'child_safety', // independent safety layer
  'operator', // privileged admin (JIT, audited)
  'system', // internal schedulers/reconcilers
] as const;

export type ActorType = (typeof ACTOR_TYPES)[number];

/**
 * Processing purposes — used for purpose-limited authorization and consent
 * binding (PIPEDA purpose limitation; PRIV-001/PRIV-004; ConsentGrant.purpose).
 */
export const PURPOSES = [
  'onboarding',
  'diagnostic',
  'tutoring',
  'evidence_projection',
  'parent_reporting',
  'school_evidence_extraction',
  'billing',
  'safety',
  'support',
  'export',
  'deletion',
] as const;

export type Purpose = (typeof PURPOSES)[number];

export interface ActorContext {
  readonly actorType: ActorType;
  /** Opaque alias, never a raw external identifier. */
  readonly actorAlias: string;
  /** Family authority scope; `null` for system/operator contexts. */
  readonly familyAlias: string | null;
  /** Learner authority scope when acting within a single learner. */
  readonly learnerAlias?: string;
  readonly purpose: Purpose;
}
