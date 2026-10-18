import { decideDelivery, type CandidateContent, type DeliveryOutcome } from '@potenova/domain-core';
import {
  trueRelation,
  areEquivalent,
  isWellFormed,
  checkMathTask,
  type Fraction,
  type MathTask,
} from './math-check';
import { validateCandidate, validationRecordRef, type ValidationRecord } from './validation';

/**
 * Deterministic item generator (WP-05; ADR-0024; CONT-004/005; AI-001; AT-20/AT-39).
 *
 * Turns ONE teachable skill into MANY practice items. It is the layer the
 * catalogue → overlay chain feeds: an overlay skill is coached through a stream
 * of items, not a handful of hand-written ones.
 *
 * Non-negotiables encoded here:
 *  - NO model. Items are produced by exact, seeded arithmetic — reproducible and
 *    reviewable — so nothing here can hallucinate a question or an answer key.
 *    (A model generator is a post-G2 change behind the same gate.)
 *  - The generator NEVER blesses its own output. Every generated item is checked
 *    by the INDEPENDENT deterministic oracle and then the LOCKED content-gate
 *    (`gateGeneratedItems`); an item whose key is wrong FAILs and is never
 *    delivered (AT-20), fail-closed.
 *  - Answer keys are computed FROM the oracle's ground truth, so a well-formed
 *    generated item is correct by construction — but it is still validated
 *    independently, because trust is not a substitute for the check.
 *
 * Scope: the fractions pilot skills that have a deterministic oracle today —
 * SK-FR-compare (comparison) and SK-FR-equiv (equivalence). Other overlay skills
 * (partition, unit, non-unit, number-line, order) need their own oracle kinds
 * before they can be generated; they are reported UNSUPPORTED rather than faked.
 */

export type Difficulty = 'intro' | 'core' | 'stretch';

export interface GeneratedItem {
  /** Stable id derived from skill+seed+index — reproducible across runs. */
  readonly candidateId: string;
  readonly skillId: string; // overlay teachable-skill id
  readonly subject: 'math';
  readonly difficulty: Difficulty;
  readonly representationHint: string;
  readonly task: MathTask; // oracle-checkable; key already set to ground truth
  readonly generatorId: string;
}

export interface GatedItem {
  readonly item: GeneratedItem;
  readonly record: ValidationRecord;
  readonly outcome: DeliveryOutcome;
}

export const GENERATOR_ID = 'item-gen:fractions-deterministic@0.1';

const COMPARE_SKILL = 'SK-FR-compare';
const EQUIV_SKILL = 'SK-FR-equiv';

/** Skills this generator can produce items for today. */
export function supportsSkill(skillId: string): boolean {
  return skillId === COMPARE_SKILL || skillId === EQUIV_SKILL;
}

/** Seeded PRNG (mulberry32) — deterministic, no Math.random. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Denominator pool by difficulty — small/unit-ish for intro, wider for stretch. */
const DENOMS: Record<Difficulty, readonly number[]> = {
  intro: [2, 3, 4],
  core: [2, 3, 4, 5, 6, 8],
  stretch: [3, 5, 6, 7, 8, 9, 10, 12],
};

const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
const f = (numerator: number, denominator: number): Fraction => ({ numerator, denominator });

function genComparison(r: () => number, d: Difficulty): { left: Fraction; right: Fraction } {
  const dl = pick(r, DENOMS[d]);
  const dr = d === 'intro' ? pick(r, DENOMS[d]) : pick(r, DENOMS[d]);
  // proper fractions; numerator in [1, denom-1]
  const nl = 1 + Math.floor(r() * (dl - 1));
  const nr = 1 + Math.floor(r() * (dr - 1));
  return { left: f(nl, dl), right: f(nr, dr) };
}

function genEquivalence(r: () => number, d: Difficulty): { left: Fraction; right: Fraction } {
  const base = f(1 + Math.floor(r() * 2), pick(r, DENOMS[d])); // small base fraction
  if (r() < 0.5) {
    // an equivalent pair: scale the base by k
    const k = 2 + Math.floor(r() * (d === 'stretch' ? 4 : 2));
    return { left: base, right: f(base.numerator * k, base.denominator * k) };
  }
  // a non-equivalent pair: a different proper fraction
  const dr = pick(r, DENOMS[d]);
  const nr = 1 + Math.floor(r() * (dr - 1));
  return { left: base, right: f(nr, dr) };
}

/**
 * Generate `count` distinct items for a skill, deterministically from `seed`.
 * Answer keys are set to the oracle's ground truth. Throws for an unsupported
 * skill (never returns faked items).
 */
export function generateItems(
  skillId: string,
  count: number,
  seed = 1,
  difficulty: Difficulty = 'core',
): GeneratedItem[] {
  if (!supportsSkill(skillId)) {
    throw new Error(`item-gen: unsupported skill ${skillId}`);
  }
  const r = rng(seed);
  const items: GeneratedItem[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (items.length < count && guard++ < count * 50) {
    let task: MathTask;
    let dedupeKey: string;
    if (skillId === COMPARE_SKILL) {
      const { left, right } = genComparison(r, difficulty);
      if (!isWellFormed(left) || !isWellFormed(right)) continue;
      task = { kind: 'fraction_comparison', left, right, claimedAnswer: trueRelation(left, right) };
      dedupeKey = `c:${left.numerator}/${left.denominator}:${right.numerator}/${right.denominator}`;
    } else {
      const { left, right } = genEquivalence(r, difficulty);
      if (!isWellFormed(left) || !isWellFormed(right)) continue;
      task = {
        kind: 'fraction_equivalence',
        left,
        right,
        claimedEquivalent: areEquivalent(left, right),
      };
      dedupeKey = `e:${left.numerator}/${left.denominator}:${right.numerator}/${right.denominator}`;
    }
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const index = items.length;
    items.push({
      candidateId: `gen:${skillId}:${seed}:${difficulty}:${index}`,
      skillId,
      subject: 'math',
      difficulty,
      representationHint: skillId === COMPARE_SKILL ? 'number-line' : 'area-model',
      task,
      generatorId: GENERATOR_ID,
    });
  }
  return items;
}

/**
 * Run each generated item through the INDEPENDENT oracle and the LOCKED
 * content-gate. Returns every item with its signed validation record and
 * delivery outcome. Only outcomes of kind 'DELIVER' may reach a child; a wrong
 * key yields FAIL → BLOCK here (fail-closed). `validatorId` MUST differ from the
 * generator id (validateCandidate throws otherwise — TM-10).
 */
export function gateGeneratedItems(
  items: readonly GeneratedItem[],
  validatorId = 'oracle:math',
  validatorVersion = 'v1',
  now?: () => string,
): GatedItem[] {
  return items.map((item) => {
    const math = checkMathTask(item.task);
    const record = validateCandidate(
      {
        candidateId: item.candidateId,
        generatorId: item.generatorId,
        validatorId,
        validatorVersion,
        math: { ran: math.ran, correct: math.ran ? math.correct : null },
        safety: { available: true, pass: true }, // synthetic items; no free-form text
        onTopic: true,
      },
      now,
    );
    const candidate: CandidateContent = {
      candidateId: record.candidateId,
      verdict: record.verdict,
      validationRecordRef: record.verdict === 'PASS' ? validationRecordRef(record) : null,
    };
    return { item, record, outcome: decideDelivery(candidate, null) };
  });
}

/** Convenience: generate, gate, and return only the items cleared for delivery. */
export function generateDeliverableItems(
  skillId: string,
  count: number,
  seed = 1,
  difficulty: Difficulty = 'core',
): GatedItem[] {
  return gateGeneratedItems(generateItems(skillId, count, seed, difficulty)).filter(
    (g) => g.outcome.kind === 'DELIVER',
  );
}
