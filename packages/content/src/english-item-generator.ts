import { decideDelivery, type CandidateContent, type DeliveryOutcome } from '@potenova/domain-core';
import {
  pluralize,
  pastTenseRegular,
  comparativeRegular,
  checkEnglishTask,
  type EnglishTask,
} from './english-check';
import { validateCandidate, validationRecordRef, type ValidationRecord } from './validation';
import type { Difficulty } from './item-generator';

/**
 * Deterministic English item generator (WP-05; ADR-0026; AI-001; AT-20/TM-10).
 *
 * The English counterpart of the fractions item generator: it turns one
 * rule-decidable morphology skill into many practice items. Same guarantees:
 *  - NO model. Items are drawn from CURATED regular word pools and their keys
 *    computed by the rule oracle in `english-check` — reproducible and reviewable.
 *    Irregulars are never in the pools (they need a reviewed lexicon, not a rule).
 *  - Every item is checked by the INDEPENDENT oracle and the LOCKED content-gate
 *    (`gateGeneratedEnglishItems`); a wrong key FAILs and is never delivered
 *    (AT-20), and the generator cannot validate its own output (TM-10).
 *
 * Scope: the regular-morphology pilot skills — plurals (base / sibilant), regular
 * past tense, and regular comparative. Open-response reading/writing is NOT here:
 * it is not rule-decidable and would need a model behind the same gate.
 */

export interface GeneratedEnglishItem {
  readonly candidateId: string;
  readonly skillId: string;
  readonly subject: 'english';
  readonly difficulty: Difficulty;
  readonly representationHint: string;
  readonly task: EnglishTask;
  readonly generatorId: string;
}

export interface GatedEnglishItem {
  readonly item: GeneratedEnglishItem;
  readonly record: ValidationRecord;
  readonly outcome: DeliveryOutcome;
}

export const ENGLISH_GENERATOR_ID = 'item-gen:english-deterministic@0.1';

const PLURAL_BASE = 'SK-EN-plural-base';
const PLURAL_SIB = 'SK-EN-plural-sibilant';
const PAST = 'SK-EN-past-regular';
const COMP = 'SK-EN-comparative';

/** Curated regular word pools, tiered simple → mid → hard. All rule-regular. */
const POOLS: Record<string, { simple: string[]; mid: string[]; hard: string[] }> = {
  [PLURAL_BASE]: {
    simple: ['dog', 'book', 'cat', 'map', 'pen', 'car', 'cup', 'hand'],
    mid: ['lake', 'tree', 'star', 'road', 'bird', 'chair'],
    hard: ['table', 'door', 'hill', 'game', 'river', 'window'],
  },
  [PLURAL_SIB]: {
    simple: ['box', 'bus', 'fox', 'wish', 'dish'],
    mid: ['glass', 'brush', 'match', 'class', 'bench'],
    hard: ['baby', 'city', 'lady', 'puppy', 'story', 'party', 'pony'],
  },
  [PAST]: {
    simple: ['walk', 'jump', 'play', 'call', 'help', 'want', 'look', 'talk'],
    mid: ['hope', 'bake', 'smile', 'use', 'close', 'like', 'move', 'save'],
    hard: ['stop', 'plan', 'clap', 'hug', 'grab', 'carry', 'hurry', 'copy', 'try', 'cry'],
  },
  [COMP]: {
    simple: ['tall', 'small', 'fast', 'slow', 'cold', 'long', 'short', 'loud', 'old'],
    mid: ['nice', 'late', 'safe', 'wide', 'rude', 'brave', 'fine'],
    hard: ['big', 'hot', 'sad', 'thin', 'fat', 'wet', 'happy', 'easy', 'lucky', 'funny'],
  },
};

const SUPPORTED: ReadonlySet<string> = new Set([PLURAL_BASE, PLURAL_SIB, PAST, COMP]);
export function supportsEnglishSkill(skillId: string): boolean {
  return SUPPORTED.has(skillId);
}

const REPRESENTATION: Record<string, string> = {
  [PLURAL_BASE]: 'written',
  [PLURAL_SIB]: 'spoken',
  [PAST]: 'written',
  [COMP]: 'written',
};

/** Words available for a skill at a difficulty (tiers are additive). */
function wordsFor(skillId: string, d: Difficulty): string[] {
  const p = POOLS[skillId]!;
  if (d === 'intro') return p.simple;
  if (d === 'core') return [...p.simple, ...p.mid];
  return [...p.simple, ...p.mid, ...p.hard];
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

function buildTask(skillId: string, word: string): EnglishTask {
  if (skillId === PLURAL_BASE || skillId === PLURAL_SIB) {
    return { kind: 'noun_plural', word, claimedPlural: pluralize(word) };
  }
  if (skillId === PAST) {
    return { kind: 'regular_past_tense', verb: word, claimedPast: pastTenseRegular(word) };
  }
  return {
    kind: 'comparative_adjective',
    adjective: word,
    claimedComparative: comparativeRegular(word),
  };
}

/**
 * Generate up to `count` distinct items for a skill, deterministically from
 * `seed`. Keys are computed by the rule oracle. Throws for an unsupported skill.
 * `count` is capped by the curated pool size at that difficulty (never padded
 * with nonsense words).
 */
export function generateEnglishItems(
  skillId: string,
  count: number,
  seed = 1,
  difficulty: Difficulty = 'core',
): GeneratedEnglishItem[] {
  if (!supportsEnglishSkill(skillId)) {
    throw new Error(`english-item-gen: unsupported skill ${skillId}`);
  }
  const pool = wordsFor(skillId, difficulty);
  const r = rng(seed);
  const used = new Set<string>();
  const items: GeneratedEnglishItem[] = [];
  const target = Math.min(count, pool.length);
  let guard = 0;
  while (items.length < target && guard++ < pool.length * 50) {
    const word = pool[Math.floor(r() * pool.length)]!;
    if (used.has(word)) continue;
    used.add(word);
    const index = items.length;
    items.push({
      candidateId: `gen:${skillId}:${seed}:${difficulty}:${index}`,
      skillId,
      subject: 'english',
      difficulty,
      representationHint: REPRESENTATION[skillId] ?? 'written',
      task: buildTask(skillId, word),
      generatorId: ENGLISH_GENERATOR_ID,
    });
  }
  return items;
}

/**
 * Run each generated item through the INDEPENDENT English oracle and the LOCKED
 * content-gate. The deterministic oracle result is carried in the validation
 * `math` slot (the subject-neutral "deterministic oracle ran + correct" signal,
 * as the task bank already does). Only 'DELIVER' outcomes may reach a child; a
 * wrong key FAILs → BLOCK (fail-closed). `validatorId` MUST differ from the
 * generator id (validateCandidate throws otherwise — TM-10).
 */
export function gateGeneratedEnglishItems(
  items: readonly GeneratedEnglishItem[],
  validatorId = 'oracle:english',
  validatorVersion = 'v1',
  now?: () => string,
): GatedEnglishItem[] {
  return items.map((item) => {
    const check = checkEnglishTask(item.task);
    const record = validateCandidate(
      {
        candidateId: item.candidateId,
        generatorId: item.generatorId,
        validatorId,
        validatorVersion,
        math: { ran: check.ran, correct: check.ran ? check.correct : null },
        safety: { available: true, pass: true },
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
export function generateDeliverableEnglishItems(
  skillId: string,
  count: number,
  seed = 1,
  difficulty: Difficulty = 'core',
): GatedEnglishItem[] {
  return gateGeneratedEnglishItems(generateEnglishItems(skillId, count, seed, difficulty)).filter(
    (g) => g.outcome.kind === 'DELIVER',
  );
}
