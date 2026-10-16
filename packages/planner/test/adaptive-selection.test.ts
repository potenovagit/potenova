import { describe, it, expect } from 'vitest';
import { buildFractionsDraftGraph } from '@potenova/curriculum';
import {
  selectNextObjective,
  explainReasonCode,
  DRAFT_PLANNER_POLICY,
  SESSION_REASON_CODES,
  type SkillMastery,
} from '../src';

/**
 * The adaptive selector reads derived mastery against the canonical graph and
 * picks the next skill. Over the oracle-backed subset SK-FR-equiv → SK-FR-compare
 * (canonical edge D-fr-6), this is a prerequisite-remediation → advancement loop.
 */

const EQUIV = 'SK-FR-equiv';
const COMPARE = 'SK-FR-compare';
const COACHABLE = [EQUIV, COMPARE] as const;

const select = (mastery: Record<string, SkillMastery>) =>
  selectNextObjective({
    graph: buildFractionsDraftGraph(),
    coachableSkillIds: COACHABLE,
    mastery,
    policy: DRAFT_PLANNER_POLICY,
  });

describe('selectNextObjective', () => {
  it('remediates to the prerequisite first for a fresh learner', () => {
    const r = select({});
    // Comparison is prerequisite-blocked; the planner resolves down to equivalence.
    expect(r.targetSkillId).toBe(EQUIV);
    expect(r.blockedSkillId).toBe(COMPARE);
    expect(r.reasonCode).toBe('PREREQUISITE_REMEDIATION');
  });

  it('advances to the dependent skill once the prerequisite is independent', () => {
    const r = select({
      [EQUIV]: { confidence: 0.9, independent: true },
      [COMPARE]: { confidence: 0, independent: false },
    });
    expect(r.targetSkillId).toBe(COMPARE);
    expect(r.blockedSkillId).toBeNull();
    // No prerequisite gap any more — comparison is now the live objective.
    expect(r.reasonCode).not.toBe('PREREQUISITE_REMEDIATION');
  });

  it('remediates back if the prerequisite regresses while the dependent is weak', () => {
    const r = select({
      [EQUIV]: { confidence: 0.3, independent: false }, // regressed / never mastered
      [COMPARE]: { confidence: 0.4, independent: false },
    });
    expect(r.targetSkillId).toBe(EQUIV);
    expect(r.blockedSkillId).toBe(COMPARE);
    expect(r.reasonCode).toBe('PREREQUISITE_REMEDIATION');
  });

  it('never traverses an unapproved edge (only approved prerequisites block)', () => {
    // Sanity: the canonical graph's equiv→compare edge is approved, so the gap is real.
    const ranked = select({}).ranked;
    expect(
      ranked.some((o) => o.skillId === COMPARE && o.reasonCode === 'PREREQUISITE_REMEDIATION'),
    ).toBe(true);
  });

  it('surfaces a mastered-but-decayed skill as REVIEW_DUE', () => {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const r = selectNextObjective({
      graph: buildFractionsDraftGraph(),
      coachableSkillIds: COACHABLE,
      mastery: {
        [EQUIV]: { confidence: 0.9, independent: true, lastPracticedAt: now },
        [COMPARE]: { confidence: 0.9, independent: true, lastPracticedAt: now - 22 * DAY },
      },
      policy: DRAFT_PLANNER_POLICY,
      now,
    });
    expect(r.targetSkillId).toBe(COMPARE);
    expect(r.reasonCode).toBe('REVIEW_DUE');
  });

  it('a guardian preference breaks a within-tier tie (never crosses a gate)', () => {
    const now = Date.now();
    // Both skills mastered & recently practised → both land in the same tier
    // (TRANSFER_CHECK). The tie breaks on skillId by default (compare < equiv).
    const mastery = {
      [EQUIV]: { confidence: 0.9, independent: true, lastPracticedAt: now },
      [COMPARE]: { confidence: 0.9, independent: true, lastPracticedAt: now },
    };
    const base = selectNextObjective({
      graph: buildFractionsDraftGraph(),
      coachableSkillIds: COACHABLE,
      mastery,
      policy: DRAFT_PLANNER_POLICY,
      now,
    });
    expect(base.targetSkillId).toBe(COMPARE);

    // A guardian preference for equivalence reorders within that tier.
    const preferred = selectNextObjective({
      graph: buildFractionsDraftGraph(),
      coachableSkillIds: COACHABLE,
      mastery,
      policy: DRAFT_PLANNER_POLICY,
      now,
      parentPreferredSkillIds: [EQUIV],
    });
    expect(preferred.targetSkillId).toBe(EQUIV);
    expect(preferred.reasonCode).toBe(base.reasonCode); // same tier — gate unchanged
  });

  it('resurfaces a REVALIDATION_REQUIRED skill above advancement', () => {
    // Equivalence was mastered then contradicted (revalidationRequired); comparison
    // could otherwise advance. The regressed core skill must be re-verified first.
    const r = select({
      [EQUIV]: { confidence: 0.9, independent: true, revalidationRequired: true },
      [COMPARE]: { confidence: 0.4, independent: false },
    });
    expect(r.targetSkillId).toBe(EQUIV);
    expect(r.reasonCode).toBe('REVALIDATION_REQUIRED');
  });

  it('a guardian preference never outranks a prerequisite gap (gate wins)', () => {
    // Fresh learner: comparison is prerequisite-blocked. Even preferring compare
    // cannot skip equivalence — the gate is non-negotiable.
    const preferred = selectNextObjective({
      graph: buildFractionsDraftGraph(),
      coachableSkillIds: COACHABLE,
      mastery: {},
      policy: DRAFT_PLANNER_POLICY,
      parentPreferredSkillIds: [COMPARE],
    });
    expect(preferred.targetSkillId).toBe(EQUIV);
    expect(preferred.reasonCode).toBe('PREREQUISITE_REMEDIATION');
  });

  it('does not flag review for a recently-practised mastered skill', () => {
    const now = Date.now();
    const r = selectNextObjective({
      graph: buildFractionsDraftGraph(),
      coachableSkillIds: COACHABLE,
      mastery: {
        [EQUIV]: { confidence: 0.9, independent: true, lastPracticedAt: now },
        [COMPARE]: { confidence: 0.9, independent: true, lastPracticedAt: now },
      },
      policy: DRAFT_PLANNER_POLICY,
      now,
    });
    expect(r.ranked.some((o) => o.reasonCode === 'REVIEW_DUE')).toBe(false);
  });

  it('only a mastered skill decays — a weak old skill is not REVIEW_DUE', () => {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const r = selectNextObjective({
      graph: buildFractionsDraftGraph(),
      coachableSkillIds: COACHABLE,
      mastery: {
        [EQUIV]: { confidence: 0.3, independent: false, lastPracticedAt: now - 99 * DAY },
        [COMPARE]: { confidence: 0.3, independent: false, lastPracticedAt: now - 99 * DAY },
      },
      policy: DRAFT_PLANNER_POLICY,
      now,
    });
    expect(r.ranked.some((o) => o.reasonCode === 'REVIEW_DUE')).toBe(false);
  });

  it('offers a transfer check for a mastered skill not yet shown in a novel context', () => {
    const now = Date.now();
    const r = selectNextObjective({
      graph: buildFractionsDraftGraph(),
      coachableSkillIds: COACHABLE,
      mastery: {
        [EQUIV]: { confidence: 0.9, independent: true, transferable: true, lastPracticedAt: now },
        [COMPARE]: {
          confidence: 0.9,
          independent: true,
          transferable: false,
          lastPracticedAt: now,
        },
      },
      policy: DRAFT_PLANNER_POLICY,
      now,
    });
    expect(r.targetSkillId).toBe(COMPARE);
    expect(r.reasonCode).toBe('TRANSFER_CHECK');
  });

  it('does not offer a transfer check once the skill is already transferable', () => {
    const now = Date.now();
    const r = selectNextObjective({
      graph: buildFractionsDraftGraph(),
      coachableSkillIds: COACHABLE,
      mastery: {
        [EQUIV]: { confidence: 0.9, independent: true, transferable: true, lastPracticedAt: now },
        [COMPARE]: { confidence: 0.9, independent: true, transferable: true, lastPracticedAt: now },
      },
      policy: DRAFT_PLANNER_POLICY,
      now,
    });
    expect(r.ranked.some((o) => o.reasonCode === 'TRANSFER_CHECK')).toBe(false);
  });

  it('gives every reason code a distinct, non-empty parent-facing explanation', () => {
    const texts = SESSION_REASON_CODES.map((code) => explainReasonCode(code));
    for (const t of texts) expect(t.trim().length).toBeGreaterThan(0);
    expect(new Set(texts).size).toBe(SESSION_REASON_CODES.length);
  });

  it('throws when no coachable skills are configured', () => {
    expect(() =>
      selectNextObjective({
        graph: buildFractionsDraftGraph(),
        coachableSkillIds: [],
        mastery: {},
        policy: DRAFT_PLANNER_POLICY,
      }),
    ).toThrow();
  });
});
