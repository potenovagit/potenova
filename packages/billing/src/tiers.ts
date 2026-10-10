import type { Subject, Term } from './policy';

/**
 * Subject entitlements + family tiers (BILL-001/002/003).
 *
 * Math-only, English-only and combined entitlements; family tiers by child count
 * and subject live in a configuration layer, so changing a tier never touches the
 * learner evidence schema. Term is metadata only (no hard-coded price).
 */

export interface FamilyTier {
  readonly tierId: string;
  readonly subjects: readonly Subject[];
  readonly childSeatLimit: number;
  readonly term: Term;
}

/** BILL-001: only purchased subjects open their full learning module. */
export function subjectEntitled(tier: FamilyTier, subject: Subject): boolean {
  return tier.subjects.includes(subject);
}

/** BILL-002: seat usage is checked against the tier's child count. */
export function withinSeatLimit(tier: FamilyTier, activeChildCount: number): boolean {
  return activeChildCount <= tier.childSeatLimit;
}
