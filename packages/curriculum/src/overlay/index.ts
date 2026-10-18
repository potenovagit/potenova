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
 * Scope today: the fractions pilot path only, anchored to the REAL Ontario
 * expectation codes now in the catalogue. The remaining expectations are mapped
 * under the educator gate, grade/strand by grade/strand — this module is the
 * mechanism and the first worked example, not full coverage.
 */

import type { CanonicalSkill, SkillDependency } from '../entities';
import { CurriculumGraph } from '../graph';
import { FRACTION_SKILLS, FRACTION_DEPENDENCIES } from '../fractions-draft';
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
    'full',
    'Standard fractional notation with the meaning of numerator and denominator.',
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
    'full',
    'Repeated addition of a unit fraction as multiplication by a whole number.',
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
    'full',
    'Equivalent fractions from halves to twelfths, incl. improper/mixed.',
  ),
  link('math', 7, 'B1.4', 'SK-FR-equiv', 'full', 'Using equivalent fractions to simplify.'),
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
  link('math', 5, 'B1.4', 'SK-FR-compare', 'full', 'Comparing and ordering fractions to twelfths.'),
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
