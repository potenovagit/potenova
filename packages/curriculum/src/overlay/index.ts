/**
 * Teachable-skill overlay (WP-02; ADR-0023).
 *
 * The layer that sits between the source-verified Ontario catalogue
 * (`../ontario`) and the adaptive engine: it proposes how official curriculum
 * expectations map to coachable **teachable skills**, and how those skills
 * depend on one another.
 *
 * This is a PROPOSAL layer, not authority:
 *  - Every mapping carries `reviewedBy: null` — unsigned until an independent
 *    educator review signs it (ER-03 / NFR-10, EVIDENCE REQUIRED). An unsigned
 *    mapping MUST NOT be presented as validated coverage.
 *  - Prerequisite edges are seeded as `proposed`, never canonical; only a
 *    review-controlled promotion (CurriculumGraph.approveDependency) makes an
 *    edge affect a learner's path (Master §12; TM-42/43).
 *  - It sets NO mastery thresholds, evidence weights, or benchmarks — those are
 *    the educator's to decide (ER-03/NFR-07/NFR-08) and live nowhere in here.
 *
 * Scope today: three worked DRAFT domains anchored to REAL Ontario codes — the
 * fractions pilot path, the addition number-facts path, and the English
 * word-formation path (plurals / regular past / comparative). These cover only
 * the skills the engine already coaches; the rest of the 849-expectation
 * catalogue is authored under the educator gate, grade/strand by grade/strand.
 * `buildOverlayWorksheet` emits the full per-expectation gap list (proposed-or-
 * blank) that drives that human authoring — this module is the mechanism and the
 * worked examples, not full coverage.
 */

import type { CanonicalSkill, SkillDependency } from '../entities';
import { CurriculumGraph } from '../graph';
import { FRACTION_SKILLS, FRACTION_DEPENDENCIES } from '../fractions-draft';
import { ADDITION_SKILLS, ADDITION_DEPENDENCIES } from '../addition-draft';
import { ENGLISH_SKILLS, ENGLISH_DEPENDENCIES } from '../english-draft';
import { ontarioDatasets, ontarioExpectations, type OntarioSubject } from '../ontario';

/** A proposed link from one official Ontario expectation to one teachable skill.
 *  DRAFT by construction: `reviewedBy` is always null here. */
export interface ProposedSkillMapping {
  readonly mappingId: string;
  readonly expectationId: string; // must resolve in the Ontario catalogue
  readonly subject: OntarioSubject;
  readonly grade: number;
  readonly sourceCode: string; // echoed from the expectation for readability
  readonly skillId: string; // a teachable skill in the overlay's skill set
  readonly coverage: 'full' | 'partial';
  readonly rationale: string; // why this expectation needs this skill (for the reviewer)
  readonly reviewedBy: null; // unsigned until educator review (never set here)
  readonly proposedBy: string; // provenance of the proposal
  readonly version: string;
}

const V = 'overlay-draft-0.1';
const PROPOSER = 'draft-authoring';

/** Catalogue expectation id, exactly as `ontarioExpectations` builds it. */
const exp = (subject: OntarioSubject, grade: number, code: string): string =>
  `EXP-ONT-${subject.toUpperCase()}-G${grade}-${code}`;

let seq = 0;
const link = (
  subject: OntarioSubject,
  grade: number,
  code: string,
  skillId: string,
  coverage: 'full' | 'partial',
  rationale: string,
): ProposedSkillMapping => ({
  mappingId: `PMAP-${String(++seq).padStart(4, '0')}`,
  expectationId: exp(subject, grade, code),
  subject,
  grade,
  sourceCode: code,
  skillId,
  coverage,
  rationale,
  reviewedBy: null,
  proposedBy: PROPOSER,
  version: V,
});

/**
 * DRAFT fractions overlay — teachable skills ↔ real Ontario Math (2020) codes.
 * The skills are the pilot set from `fractions-draft`. Each link is a proposal
 * for the educator to confirm, refine, or reject; none is signed.
 */
export const FRACTIONS_OVERLAY: readonly ProposedSkillMapping[] = [
  // Partition a whole into equal parts — the fair-share entry point.
  link(
    'math',
    1,
    'B1.6',
    'SK-FR-partition',
    'partial',
    'Fair-share with 2 and 4 sharers is the first equal-partitioning work.',
  ),
  link(
    'math',
    2,
    'B1.6',
    'SK-FR-partition',
    'partial',
    'Extends fair-share partitioning to more sharers and to comparison.',
  ),
  // Name unit fractions.
  link(
    'math',
    1,
    'B1.7',
    'SK-FR-unit',
    'partial',
    'One half = two fourths introduces unit-fraction naming informally.',
  ),
  link(
    'math',
    4,
    'B1.4',
    'SK-FR-unit',
    'partial',
    'Expectation spans halves–tenths, standard notation and numerator/denominator meaning — broader than unit-fraction naming (pre-review NFR-10: was over-claimed as full).',
  ),
  // Build non-unit fractions as counts of unit fractions.
  link(
    'math',
    3,
    'B2.8',
    'SK-FR-nonunit',
    'full',
    'Numerator as repeated addition of a unit fraction.',
  ),
  link(
    'math',
    4,
    'B2.7',
    'SK-FR-nonunit',
    'partial',
    'Expectation frames this as MULTIPLICATION of a unit fraction by a whole number; SK-FR-nonunit covers the repeated-addition view only (educator round-2: was over-claimed as full).',
  ),
  // Place fractions on a number line.
  link(
    'math',
    4,
    'B1.5',
    'SK-FR-numberline',
    'partial',
    'Representing and ordering fair-share fractions supports number-line placement.',
  ),
  link(
    'math',
    5,
    'B1.4',
    'SK-FR-numberline',
    'partial',
    'Comparing/ordering to twelfths is commonly modelled on a number line.',
  ),
  // Recognize equivalent fractions.
  link(
    'math',
    1,
    'B1.7',
    'SK-FR-equiv',
    'partial',
    'One half and two fourths of the same whole are equal — first concrete equivalence (pre-review NFR-10: previously unmapped to equivalence).',
  ),
  link(
    'math',
    2,
    'B1.7',
    'SK-FR-equiv',
    'partial',
    'One third and two sixths of the same whole are equal — concrete equivalence (pre-review NFR-10: previously unmapped).',
  ),
  link(
    'math',
    3,
    'B1.7',
    'SK-FR-equiv',
    'partial',
    'Determining and using equivalent fractions in fair-share contexts.',
  ),
  link(
    'math',
    4,
    'B1.9',
    'SK-FR-equiv',
    'partial',
    'Equivalences among fractions and decimal tenths.',
  ),
  link(
    'math',
    5,
    'B1.3',
    'SK-FR-equiv',
    'partial',
    'Expectation includes improper fractions and mixed numbers, beyond recognizing equivalent proper fractions (educator round-2: was over-claimed as full).',
  ),
  link(
    'math',
    7,
    'B1.4',
    'SK-FR-equiv',
    'partial',
    'Expectation is using equivalence to SIMPLIFY, not just recognizing it — needs a simplification skill (educator round-2: recognition mistaken for full simplification).',
  ),
  // Compare two fractions.
  link(
    'math',
    1,
    'B1.8',
    'SK-FR-compare',
    'partial',
    'Comparing and ordering unit fractions by drawings.',
  ),
  link(
    'math',
    2,
    'B1.6',
    'SK-FR-compare',
    'partial',
    'Comparing the results of fair-share problems.',
  ),
  link(
    'math',
    4,
    'B1.5',
    'SK-FR-compare',
    'partial',
    'Comparing fractions from fair-share scenarios.',
  ),
  link(
    'math',
    5,
    'B1.4',
    'SK-FR-compare',
    'partial',
    'Expectation requires compare AND order (incl. improper/mixed) — ordering is the separate SK-FR-order skill (pre-review NFR-10: was over-claimed as full).',
  ),
  link(
    'math',
    6,
    'B1.3',
    'SK-FR-compare',
    'partial',
    'Comparing fractions alongside integers and decimals.',
  ),
  // Order fractions in context.
  link('math', 4, 'B1.5', 'SK-FR-order', 'partial', 'Ordering fair-share fractions.'),
  link('math', 5, 'B1.4', 'SK-FR-order', 'partial', 'Ordering fractions to twelfths in context.'),
];

/** The teachable skills the overlay references (pilot set). */
export const OVERLAY_SKILLS: readonly CanonicalSkill[] = FRACTION_SKILLS;

/** Build the set of every valid catalogue expectation id, once. */
function catalogueExpectationIds(): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const d of ontarioDatasets())
    for (const e of ontarioExpectations(d)) ids.add(e.expectationId);
  return ids;
}

/**
 * Validate an overlay against the catalogue and skill set. Throws on any
 * structural problem so an unsound overlay can never load. Does NOT judge
 * pedagogical correctness — that is the educator's (this is why links are
 * unsigned). Pure; used at load and in tests.
 */
export function validateOverlay(
  links: readonly ProposedSkillMapping[],
  skills: readonly CanonicalSkill[] = OVERLAY_SKILLS,
  catalogueIds: ReadonlySet<string> = catalogueExpectationIds(),
): void {
  const skillIds = new Set(skills.map((s) => s.skillId));
  const seenMappingIds = new Set<string>();
  for (const m of links) {
    if (seenMappingIds.has(m.mappingId))
      throw new Error(`overlay: duplicate mapping ${m.mappingId}`);
    seenMappingIds.add(m.mappingId);
    if (m.reviewedBy !== null)
      throw new Error(`overlay: ${m.mappingId} is pre-signed; DRAFT links must be unsigned`);
    if (m.expectationId !== exp(m.subject, m.grade, m.sourceCode))
      throw new Error(`overlay: ${m.mappingId} id/subject/grade/code mismatch`);
    if (!catalogueIds.has(m.expectationId))
      throw new Error(`overlay: ${m.mappingId} references unknown expectation ${m.expectationId}`);
    if (!skillIds.has(m.skillId))
      throw new Error(`overlay: ${m.mappingId} references unknown skill ${m.skillId}`);
    if (!m.rationale || m.rationale.trim().length < 3)
      throw new Error(`overlay: ${m.mappingId} empty rationale`);
  }
}

validateOverlay(FRACTIONS_OVERLAY);

/**
 * Build a graph of the overlay's teachable skills with the prerequisite edges
 * seeded as PROPOSED (never approved here). Canonical traversal ignores
 * proposed edges, so this cannot change any learner's path until a reviewer
 * promotes each edge. The returned graph is asserted acyclic.
 */
export function buildProposedOverlayGraph(
  skills: readonly CanonicalSkill[] = OVERLAY_SKILLS,
  deps: readonly SkillDependency[] = FRACTION_DEPENDENCIES,
): CurriculumGraph {
  const g = new CurriculumGraph();
  for (const s of skills) g.addSkill(s);
  for (const d of deps) g.proposeDependency(d); // lands as 'proposed'
  if (g.hasCycle()) throw new Error('overlay: proposed prerequisite graph has a cycle');
  return g;
}

/** Which teachable skills a single expectation is proposed to need (DRAFT). */
export function skillsForExpectation(
  expectationId: string,
  links: readonly ProposedSkillMapping[] = FRACTIONS_OVERLAY,
): readonly string[] {
  return links.filter((m) => m.expectationId === expectationId).map((m) => m.skillId);
}

/**
 * DRAFT mapping coverage per subject/grade: how many of the catalogue's
 * expectations have at least one proposed teachable-skill link. Useful for
 * NFR-10 tracking and for showing the educator what remains unmapped. All
 * counts describe DRAFT proposals, not validated coverage.
 */
export function overlayCoverage(
  links: readonly ProposedSkillMapping[] = FRACTIONS_OVERLAY,
): Array<{ subject: string; grade: number; expectations: number; mappedDraft: number }> {
  const mappedByKey = new Map<string, Set<string>>();
  for (const m of links) {
    const k = `${m.subject}|${m.grade}`;
    (mappedByKey.get(k) ?? mappedByKey.set(k, new Set()).get(k)!).add(m.expectationId);
  }
  return ontarioDatasets().map((d) => ({
    subject: d.subject,
    grade: d.grade,
    expectations: d.expectations.length,
    mappedDraft: mappedByKey.get(`${d.subject}|${d.grade}`)?.size ?? 0,
  }));
}

/* ==========================================================================
 *  Multi-domain overlay registry
 * ==========================================================================
 * Each worked domain bundles its teachable skills, its PROPOSED prerequisite
 * edges, and its expectation→skill mappings. Every domain is DRAFT/unsigned —
 * the registry is the mechanism for authoring more domains, not a claim of
 * validated coverage. The fractions domain above is the first; addition and
 * English word-formation follow, mapping the skills the engine already coaches
 * to the real catalogue codes they serve. The rest of the catalogue stays
 * unmapped until an educator authors it (see `buildOverlayWorksheet`). */

/** A self-contained DRAFT overlay for one strand/skill family. */
export interface DomainOverlay {
  readonly domainId: string;
  readonly skills: readonly CanonicalSkill[];
  readonly dependencies: readonly SkillDependency[];
  readonly mappings: readonly ProposedSkillMapping[];
}

/**
 * DRAFT addition overlay — the number-facts skills ↔ real Ontario Math (2020)
 * codes. Proposals for the educator to confirm/refine/reject; none is signed.
 */
export const ADDITION_OVERLAY: readonly ProposedSkillMapping[] = [
  link(
    'math',
    1,
    'B2.2',
    'SK-NS-add-within10',
    'partial',
    'Expectation also includes related subtraction facts (unmapped) — addition fluency is only part (pre-review NFR-10: was over-claimed as full).',
  ),
  link(
    'math',
    1,
    'B2.4',
    'SK-NS-add-within10',
    'partial',
    'Representing and solving addition situations within 10 with objects/equations.',
  ),
  link(
    'math',
    1,
    'B2.3',
    'SK-NS-add-within10',
    'partial',
    'Mental strategies to add within 10 (part of a broader add/subtract expectation).',
  ),
  link(
    'math',
    2,
    'B2.2',
    'SK-NS-add-within20',
    'partial',
    'Expectation also includes related subtraction facts (unmapped) — addition fluency is only part (pre-review NFR-10: was over-claimed as full).',
  ),
  link(
    'math',
    2,
    'B2.4',
    'SK-NS-add-within20',
    'partial',
    'Representing and solving addition situations within 20 with objects/equations.',
  ),
  link(
    'math',
    2,
    'B2.3',
    'SK-NS-add-within20',
    'partial',
    'Mental strategies to add within 20 (part of a broader add/subtract expectation).',
  ),
];

/**
 * DRAFT English word-formation overlay — plural / regular-past / comparative
 * skills ↔ real Ontario Language (2023) codes. The relevant codes are the
 * morphology/spelling expectations (bases + suffixes) and the parts-of-speech
 * expectations; each link is partial because those expectations span far more
 * than any one skill. Proposals for the educator; none is signed.
 */
export const ENGLISH_OVERLAY: readonly ProposedSkillMapping[] = [
  link(
    'language',
    1,
    'B2.6',
    'SK-EN-plural-base',
    'partial',
    'Using base + suffix morphology to spell words includes the regular plural -s.',
  ),
  link(
    'language',
    2,
    'B2.3',
    'SK-EN-plural-base',
    'partial',
    'Continued morpheme/suffix spelling knowledge covers the regular plural -s.',
  ),
  link(
    'language',
    2,
    'B2.3',
    'SK-EN-plural-sibilant',
    'partial',
    'Suffix spelling for sibilant stems (-es) and consonant-y → -ies.',
  ),
  link(
    'language',
    3,
    'B2.3',
    'SK-EN-plural-sibilant',
    'partial',
    'Consolidated suffix spelling for -es / consonant-y → -ies plurals.',
  ),
  link(
    'language',
    2,
    'B3.2',
    'SK-EN-past-regular',
    'partial',
    'Functions of parts of speech include verb tense; the regular past is the -ed inflection.',
  ),
  link(
    'language',
    3,
    'B2.3',
    'SK-EN-past-regular',
    'partial',
    'Suffix spelling (-ed, with doubling / drop-e / y→ied) for the regular past tense.',
  ),
  link(
    'language',
    3,
    'B2.3',
    'SK-EN-comparative',
    'partial',
    'Suffix spelling (-er, with doubling / drop-e / y→ier) for the regular comparative.',
  ),
  link(
    'language',
    3,
    'B3.2',
    'SK-EN-comparative',
    'partial',
    'Functions of parts of speech include comparative adjectives (the -er form).',
  ),
];

/** Every worked DRAFT domain. Authoring a new strand adds a domain here. */
export const OVERLAYS: readonly DomainOverlay[] = [
  {
    domainId: 'fractions',
    skills: FRACTION_SKILLS,
    dependencies: FRACTION_DEPENDENCIES,
    mappings: FRACTIONS_OVERLAY,
  },
  {
    domainId: 'addition',
    skills: ADDITION_SKILLS,
    dependencies: ADDITION_DEPENDENCIES,
    mappings: ADDITION_OVERLAY,
  },
  {
    domainId: 'english',
    skills: ENGLISH_SKILLS,
    dependencies: ENGLISH_DEPENDENCIES,
    mappings: ENGLISH_OVERLAY,
  },
];

/** Every proposed mapping across all domains (flattened). */
export function allOverlayMappings(): readonly ProposedSkillMapping[] {
  return OVERLAYS.flatMap((o) => o.mappings);
}

/** Every teachable skill referenced by any domain. */
export function allOverlaySkills(): readonly CanonicalSkill[] {
  return OVERLAYS.flatMap((o) => o.skills);
}

/**
 * Validate every domain against its own skill set and the catalogue, and assert
 * mapping ids are unique across all domains. Throws on any structural problem so
 * an unsound registry can never load. Pedagogical correctness is still the
 * educator's (links stay unsigned). Pure; used at load and in tests.
 */
export function validateAllOverlays(
  overlays: readonly DomainOverlay[] = OVERLAYS,
  catalogueIds: ReadonlySet<string> = catalogueExpectationIds(),
): void {
  const seen = new Set<string>();
  for (const o of overlays) {
    validateOverlay(o.mappings, o.skills, catalogueIds);
    for (const m of o.mappings) {
      if (seen.has(m.mappingId))
        throw new Error(`overlay: mapping id ${m.mappingId} reused across domains`);
      seen.add(m.mappingId);
    }
  }
}

/** One row of the educator coverage worksheet: a catalogue expectation with its
 *  DRAFT proposal(s), or blank where nothing is proposed yet. */
export interface OverlayWorksheetRow {
  readonly subject: string;
  readonly grade: number;
  readonly strand: string;
  readonly overallCode: string;
  readonly sourceCode: string;
  readonly expectationId: string;
  readonly text: string;
  readonly proposedSkillIds: string; // comma-joined; '' when unmapped
  readonly coverage: string; // comma-joined; '' when unmapped
  readonly proposedBy: string; // '' when unmapped
  readonly rationale: string; // ' | '-joined; '' when unmapped
  readonly status: 'PROPOSED (unsigned)' | 'UNMAPPED';
}

/**
 * The full G1–8 coverage/gap worksheet: one row per catalogue expectation across
 * every loaded dataset, joined with the DRAFT proposals. Every proposed row is
 * explicitly unsigned; every unmapped row is a gap for an educator to author.
 * This is the input artifact to the human authoring track (NFR-10 tracking) —
 * it asserts NO validated coverage. Pure/deterministic from catalogue + overlays.
 */
export function buildOverlayWorksheet(
  overlays: readonly DomainOverlay[] = OVERLAYS,
): readonly OverlayWorksheetRow[] {
  const byExpectation = new Map<string, ProposedSkillMapping[]>();
  for (const o of overlays)
    for (const m of o.mappings)
      (
        byExpectation.get(m.expectationId) ??
        byExpectation.set(m.expectationId, []).get(m.expectationId)!
      ).push(m);

  const rows: OverlayWorksheetRow[] = [];
  for (const d of ontarioDatasets()) {
    const strandName = new Map(d.strands.map((s) => [s.code, s.name]));
    for (const e of d.expectations) {
      const expectationId = `EXP-ONT-${d.subject.toUpperCase()}-G${d.grade}-${e.sourceCode}`;
      const proposals = byExpectation.get(expectationId) ?? [];
      rows.push({
        subject: d.subject,
        grade: d.grade,
        strand: strandName.get(e.strand) ?? e.strand,
        overallCode: e.overallCode,
        sourceCode: e.sourceCode,
        expectationId,
        text: e.text,
        proposedSkillIds: proposals.map((m) => m.skillId).join(', '),
        coverage: proposals.map((m) => m.coverage).join(', '),
        proposedBy: proposals.length ? proposals[0]!.proposedBy : '',
        rationale: proposals.map((m) => m.rationale).join(' | '),
        status: proposals.length ? 'PROPOSED (unsigned)' : 'UNMAPPED',
      });
    }
  }
  return rows;
}

// Load-time guard: every domain must be structurally sound.
validateAllOverlays();
