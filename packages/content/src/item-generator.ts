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
 * Scope: the full fractions pilot path — partition, unit, non-unit, number-line,
 * compare, equivalence, and order — each with its own deterministic oracle kind
 * in `math-check`. A skill without an oracle kind is reported UNSUPPORTED rather
 * than faked. English generation is a later slice on the same pattern.
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
const PARTITION_SKILL = 'SK-FR-partition';
const UNIT_SKILL = 'SK-FR-unit';
const NONUNIT_SKILL = 'SK-FR-nonunit';
const NUMBERLINE_SKILL = 'SK-FR-numberline';
const ORDER_SKILL = 'SK-FR-order';

/** Every fraction pilot skill now has a deterministic oracle + generator. */
const SUPPORTED: ReadonlySet<string> = new Set([
  COMPARE_SKILL,
  EQUIV_SKILL,
  PARTITION_SKILL,
  UNIT_SKILL,
  NONUNIT_SKILL,
  NUMBERLINE_SKILL,
  ORDER_SKILL,
]);

/** Skills this generator can produce items for. */
export function supportsSkill(skillId: string): boolean {
  return SUPPORTED.has(skillId);
}

const REPRESENTATION: Record<string, string> = {
  [COMPARE_SKILL]: 'number-line',
  [EQUIV_SKILL]: 'area-model',
  [PARTITION_SKILL]: 'area-model',
  [UNIT_SKILL]: 'area-model',
  [NONUNIT_SKILL]: 'area-model',
  [NUMBERLINE_SKILL]: 'number-line',
  [ORDER_SKILL]: 'number-line',
};

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

/** Denominator pool by difficulty. Tiers are DISJOINT so an intro item can never
 *  duplicate a core/stretch one (educator round-2: repeated questions across tiers). */
const DENOMS: Record<Difficulty, readonly number[]> = {
  intro: [2, 3, 4],
  core: [5, 6, 8],
  stretch: [7, 9, 10, 12],
};

const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
const f = (numerator: number, denominator: number): Fraction => ({ numerator, denominator });

const fracKey = (x: Fraction): string => `${x.numerator}/${x.denominator}`;

/** One well-formed candidate task + its dedupe key, for a given skill. Answer
 *  keys are set to the oracle's ground truth; returns null to skip a bad draw. */
function buildTask(
  skillId: string,
  r: () => number,
  d: Difficulty,
): { task: MathTask; dedupeKey: string } | null {
  switch (skillId) {
    case COMPARE_SKILL: {
      // From core up, ~1/4 of the time build an EQUALITY case (right is an
      // equivalent of left), so the bank actually exercises the `eq` answer
      // (educator round-2: no equality answers). Intro stays lt/gt with small
      // denominators. Otherwise two independent proper fractions.
      let left: Fraction;
      let right: Fraction;
      if (d !== 'intro' && r() < 0.25) {
        const b = pick(r, DENOMS[d]);
        const num = 1 + Math.floor(r() * (b - 1));
        const k = 2 + Math.floor(r() * 2);
        left = f(num, b);
        right = f(num * k, b * k);
      } else {
        const bl = pick(r, DENOMS[d]);
        const br = pick(r, DENOMS[d]);
        left = f(1 + Math.floor(r() * (bl - 1)), bl);
        right = f(1 + Math.floor(r() * (br - 1)), br);
      }
      if (!isWellFormed(left) || !isWellFormed(right)) return null;
      return {
        task: {
          kind: 'fraction_comparison',
          left,
          right,
          claimedAnswer: trueRelation(left, right),
        },
        dedupeKey: `c:${fracKey(left)}:${fracKey(right)}`,
      };
    }
    case EQUIV_SKILL: {
      // Deliberate ~50/50 true/false balance (educator round-2: 89% were true).
      // The FALSE case is a near-miss (scaled, then the numerator nudged by 1) so
      // it is a real discriminator, not an obvious mismatch. Labels still come
      // from the oracle, never assumed.
      const base = f(1 + Math.floor(r() * 2), pick(r, DENOMS[d]));
      const k = 2 + Math.floor(r() * (d === 'stretch' ? 4 : 2));
      const right =
        r() < 0.5
          ? f(base.numerator * k, base.denominator * k) // equivalent
          : f(base.numerator * k + 1, base.denominator * k); // near-miss, non-equivalent
      if (!isWellFormed(base) || !isWellFormed(right)) return null;
      return {
        task: {
          kind: 'fraction_equivalence',
          left: base,
          right,
          claimedEquivalent: areEquivalent(base, right),
        },
        dedupeKey: `e:${fracKey(base)}:${fracKey(right)}`,
      };
    }
    case PARTITION_SKILL: {
      const parts = pick(r, DENOMS[d]);
      const shaded = 1 + Math.floor(r() * (parts - 1)); // 1..parts-1
      return {
        task: {
          kind: 'fraction_partition',
          parts,
          shaded,
          claimedFraction: f(shaded, parts),
        },
        dedupeKey: `p:${shaded}/${parts}`,
      };
    }
    case UNIT_SKILL: {
      const denominator = pick(r, DENOMS[d]);
      return {
        task: { kind: 'fraction_unit', denominator, claimedUnit: f(1, denominator) },
        dedupeKey: `u:${denominator}`,
      };
    }
    case NONUNIT_SKILL: {
      const unitDenominator = pick(r, DENOMS[d]);
      const count = 2 + Math.floor(r() * (unitDenominator - 1)); // 2..unitDenominator
      return {
        task: {
          kind: 'fraction_nonunit_build',
          count,
          unitDenominator,
          claimedFraction: f(count, unitDenominator),
        },
        dedupeKey: `n:${count}x1/${unitDenominator}`,
      };
    }
    case NUMBERLINE_SKILL: {
      // choose intervals = denominator so the fraction always lands on a tick
      const intervals = pick(r, DENOMS[d]);
      const num = 1 + Math.floor(r() * (intervals - 1)); // proper fraction num/intervals
      const fraction = f(num, intervals);
      // tick index is exact: num * intervals / intervals = num
      return {
        task: { kind: 'fraction_number_line', fraction, intervals, claimedTick: num },
        dedupeKey: `nl:${fracKey(fraction)}@${intervals}`,
      };
    }
    case ORDER_SKILL: {
      const n = 3;
      // From core up, ~half the time use UNLIKE denominators so ordering requires
      // real comparison, not just numerator order (educator round-2: all like-denominator).
      const unlike = d !== 'intro' && r() < 0.5;
      const fractions: Fraction[] = [];
      let g = 0;
      if (unlike) {
        while (fractions.length < n && g++ < 80) {
          const b = pick(r, DENOMS[d]);
          const cand = f(1 + Math.floor(r() * (b - 1)), b);
          // keep values distinct so the order is strict
          if (fractions.every((x) => trueRelation(x, cand) !== 'eq')) fractions.push(cand);
        }
      } else {
        const denom = pick(r, DENOMS[d]);
        const nums = new Set<number>();
        while (nums.size < n && g++ < 80) nums.add(1 + Math.floor(r() * (denom - 1)));
        for (const num of nums) fractions.push(f(num, denom));
      }
      if (fractions.length < n) return null;
      const claimedOrder = fractions
        .map((_, i) => i)
        .sort((a, b) => trueRelationSign(fractions[a]!, fractions[b]!));
      return {
        task: { kind: 'fraction_order', fractions, claimedOrder },
        // Canonical (value-sorted) set key, so permutations of the SAME three
        // fractions are one problem, not several (educator: permutations counted
        // as distinct strings).
        dedupeKey: `o:${[...fractions]
          .sort((a, b) => trueRelationSign(a, b))
          .map(fracKey)
          .join(',')}`,
      };
    }
    default:
      return null;
  }
}

const trueRelationSign = (a: Fraction, b: Fraction): number => {
  const rel = trueRelation(a, b);
  return rel === 'lt' ? -1 : rel === 'gt' ? 1 : 0;
};

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
  while (items.length < count && guard++ < count * 80) {
    const built = buildTask(skillId, r, difficulty);
    if (!built) continue;
    if (seen.has(built.dedupeKey)) continue;
    seen.add(built.dedupeKey);
    const index = items.length;
    items.push({
      candidateId: `gen:${skillId}:${seed}:${difficulty}:${index}`,
      skillId,
      subject: 'math',
      difficulty,
      representationHint: REPRESENTATION[skillId] ?? 'area-model',
      task: built.task,
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
