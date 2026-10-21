import { describe, it, expect } from 'vitest';
import {
  evaluateConceptualMastery,
  ER03_CANDIDATE_V02,
  type ConceptualEvidence,
  type EvidenceDimension,
} from '@potenova/learner-state';

/**
 * Conceptual-mastery gate (ER-03 candidate v0.2) — the behaviours the educator
 * asked to see demonstrated. CANDIDATE policy; synthetic only.
 */

const EQUIV = ER03_CANDIDATE_V02.skills['SK-FR-equiv']!;

let seq = 0;
function ev(
  dimension: EvidenceDimension,
  correct: boolean,
  o: {
    band?: 'A0' | 'A1' | 'A4';
    mode?: 'independent_check' | 'transfer_check' | 'teaching';
    rep?: string;
    family?: string;
    day?: number;
  } = {},
): ConceptualEvidence {
  seq += 1;
  return {
    eventId: `e${seq}`,
    skillId: 'SK-FR-equiv',
    gradeTarget: 5,
    dimension,
    correct,
    assistanceBand: o.band ?? 'A0',
    mode: o.mode ?? 'independent_check',
    representation: o.rep ?? 'area-model',
    itemFamilyId: o.family ?? `fam-${dimension}-${seq}`,
    observedAt: `2026-10-${String(o.day ?? 1).padStart(2, '0')}T10:00:00Z`,
  };
}

/** A complete, independent, well-diversified bundle across 2 sessions and 3 reps. */
function fullBundle(): ConceptualEvidence[] {
  return [
    ev('model', true, { rep: 'area-model', family: 'm1', day: 1 }),
    ev('value', true, { rep: 'symbolic', family: 'v1', day: 1 }),
    ev('value', true, { rep: 'area-model', family: 'v2', day: 2 }),
    ev('reasoning', true, { rep: 'symbolic', family: 'r1', day: 2 }),
    ev('transfer', true, { mode: 'transfer_check', rep: 'number-line', family: 't1', day: 2 }),
  ];
}

describe('conceptual mastery (ER-03 candidate v0.2)', () => {
  it('reaches INDEPENDENT on a complete, diversified, unaided bundle', () => {
    const r = evaluateConceptualMastery(fullBundle(), EQUIV);
    expect(r.state).toBe('INDEPENDENT');
    expect(r.unmet).toHaveLength(0);
    expect(r.sessions).toBeGreaterThanOrEqual(2);
    expect(r.representations).toBeGreaterThanOrEqual(2);
    // the anchor is the moment the LAST requirement was met — day 2, not day 1
    expect(r.independenceAt).toBe('2026-10-02T10:00:00.000Z');
  });

  it('independenceAt is null when mastery is not demonstrated', () => {
    expect(evaluateConceptualMastery([], EQUIV).independenceAt).toBeNull();
    const oneDay = fullBundle().map((e) => ({ ...e, observedAt: '2026-10-01T10:00:00Z' }));
    expect(evaluateConceptualMastery(oneDay, EQUIV).independenceAt).toBeNull();
  });

  // The behaviour the educator specifically wanted demonstrated.
  it('does NOT reach INDEPENDENT when VALUE is right but REASONING is wrong', () => {
    const events: ConceptualEvidence[] = [
      ev('model', true, { rep: 'area-model', family: 'm1', day: 1 }),
      ev('value', true, { rep: 'symbolic', family: 'v1', day: 1 }),
      ev('value', true, { rep: 'area-model', family: 'v2', day: 2 }),
      ev('reasoning', false, { rep: 'symbolic', family: 'r1', day: 2 }), // picked a misconception distractor
      ev('transfer', true, { mode: 'transfer_check', rep: 'number-line', family: 't1', day: 2 }),
    ];
    const r = evaluateConceptualMastery(events, EQUIV);
    expect(r.state).toBe('NOT_YET_DEMONSTRATED');
    expect(r.unmet.some((u) => u.startsWith('reasoning'))).toBe(true);
    const reasoning = r.dimensions.find((d) => d.dimension === 'reasoning')!;
    expect(reasoning.have).toBe(0);
    expect(reasoning.met).toBe(false);
  });

  // Educator correction: isolate the REASONING gate. Everything else passes —
  // 5 distinct eligible families, both sessions, representations, and the model/
  // value/transfer quotas — and ONLY reasoning is unmet (0/1).
  it('reasoning gate ALONE withholds mastery (all other requirements pass)', () => {
    const events: ConceptualEvidence[] = [
      ev('model', true, { rep: 'area-model', family: 'm1', day: 1 }),
      ev('value', true, { rep: 'symbolic', family: 'v1', day: 1 }),
      ev('value', true, { rep: 'area-model', family: 'v2', day: 2 }),
      ev('value', true, { rep: 'number-line', family: 'v3', day: 2 }), // 5th eligible family
      ev('transfer', true, { mode: 'transfer_check', rep: 'number-line', family: 't1', day: 2 }),
      ev('reasoning', false, { rep: 'symbolic', family: 'r1', day: 2 }), // wrong — not eligible
    ];
    const r = evaluateConceptualMastery(events, EQUIV);
    expect(r.state).toBe('NOT_YET_DEMONSTRATED');
    expect(r.eligibleCount).toBe(5); // family minimum IS met
    expect(r.sessions).toBeGreaterThanOrEqual(2);
    expect(r.representations).toBeGreaterThanOrEqual(2);
    // every dimension met EXCEPT reasoning
    for (const d of r.dimensions) expect(d.met).toBe(d.dimension !== 'reasoning');
    // and the ONLY unmet reason is reasoning
    expect(r.unmet).toHaveLength(1);
    expect(r.unmet[0]!.startsWith('reasoning')).toBe(true);
  });

  it('does NOT count assisted (A4) success toward INDEPENDENT (AT-09)', () => {
    const assisted = fullBundle().map((e) => ({ ...e, assistanceBand: 'A4' as const }));
    const r = evaluateConceptualMastery(assisted, EQUIV);
    expect(r.state).toBe('NOT_YET_DEMONSTRATED');
    expect(r.eligibleCount).toBe(0);
  });

  it('does NOT reach INDEPENDENT from a single session', () => {
    const oneDay = fullBundle().map((e) => ({ ...e, observedAt: '2026-10-01T10:00:00Z' }));
    const r = evaluateConceptualMastery(oneDay, EQUIV);
    expect(r.state).toBe('NOT_YET_DEMONSTRATED');
    expect(r.unmet.some((u) => u.includes('session'))).toBe(true);
  });

  it('a repeated template cannot satisfy two value slots (distinct families required)', () => {
    const events: ConceptualEvidence[] = [
      ev('model', true, { rep: 'area-model', family: 'm1', day: 1 }),
      ev('value', true, { rep: 'symbolic', family: 'SAME', day: 1 }),
      ev('value', true, { rep: 'area-model', family: 'SAME', day: 2 }), // same family — not a 2nd demonstration
      ev('reasoning', true, { rep: 'symbolic', family: 'r1', day: 2 }),
      ev('transfer', true, { mode: 'transfer_check', rep: 'number-line', family: 't1', day: 2 }),
    ];
    const r = evaluateConceptualMastery(events, EQUIV);
    expect(r.state).toBe('NOT_YET_DEMONSTRATED');
    const value = r.dimensions.find((d) => d.dimension === 'value')!;
    expect(value.have).toBe(1); // deduped to one family
  });

  it('reaches RETAINED when an independent check lands after the retention delay', () => {
    const events = [
      ...fullBundle(),
      ev('value', true, { rep: 'number-line', family: 'v3', day: 12 }), // > 7 days later
    ];
    const r = evaluateConceptualMastery(events, EQUIV);
    expect(r.state).toBe('RETAINED');
  });

  // Retention is anchored to INDEPENDENCE. The bundle first satisfies all
  // requirements on day 2 (2026-10-02T10:00:00Z); the delay is 168h (7 days).
  const retentionEvent = (iso: string): ConceptualEvidence => ({
    eventId: 'ret',
    skillId: 'SK-FR-equiv',
    gradeTarget: 5,
    dimension: 'value',
    correct: true,
    assistanceBand: 'A0',
    mode: 'independent_check',
    representation: 'number-line',
    itemFamilyId: 'ret-fam',
    observedAt: iso,
  });

  // Educator correction: the window starts at independence, not first evidence.
  it('retention anchors to INDEPENDENCE, not first evidence', () => {
    // A check 168h after the FIRST event (2026-10-08) is only 144h after
    // independence (2026-10-02) — it must NOT count as retained.
    const r = evaluateConceptualMastery(
      [...fullBundle(), retentionEvent('2026-10-08T10:00:00Z')],
      EQUIV,
    );
    expect(r.state).toBe('INDEPENDENT');
  });

  it('retention boundary: a check 1h SHORT of 168h after independence stays INDEPENDENT', () => {
    const r = evaluateConceptualMastery(
      [...fullBundle(), retentionEvent('2026-10-09T09:00:00Z')], // 167h after independence
      EQUIV,
    );
    expect(r.state).toBe('INDEPENDENT');
  });

  it('retention boundary: a check AT 168h after independence becomes RETAINED', () => {
    const r = evaluateConceptualMastery(
      [...fullBundle(), retentionEvent('2026-10-09T10:00:00Z')], // exactly 168h after independence
      EQUIV,
    );
    expect(r.state).toBe('RETAINED');
  });

  it('is UNKNOWN with no evidence', () => {
    expect(evaluateConceptualMastery([], EQUIV).state).toBe('UNKNOWN');
  });

  // R3 — retention_check mode counts ONLY toward the post-independence gate.
  const delayedEvent = (
    iso: string,
    mode: ConceptualEvidence['mode'],
    band: ConceptualEvidence['assistanceBand'] = 'A0',
  ): ConceptualEvidence => ({
    eventId: `d-${mode}`,
    skillId: 'SK-FR-equiv',
    gradeTarget: 5,
    dimension: 'value',
    correct: true,
    assistanceBand: band,
    mode,
    representation: 'number-line',
    itemFamilyId: 'ret-fam',
    observedAt: iso,
  });

  it('a delayed retention_check from a NEW family at the delay confirms RETAINED', () => {
    const r = evaluateConceptualMastery(
      [...fullBundle(), delayedEvent('2026-10-09T10:00:00Z', 'retention_check')],
      EQUIV,
    );
    expect(r.state).toBe('RETAINED');
  });

  it('a delayed teaching-mode event never confirms retention (stays INDEPENDENT)', () => {
    const r = evaluateConceptualMastery(
      [...fullBundle(), delayedEvent('2026-10-09T10:00:00Z', 'teaching')],
      EQUIV,
    );
    expect(r.state).toBe('INDEPENDENT');
  });

  it('retention_check can never by itself establish initial independence', () => {
    // a full bundle's worth of retention_check events — none count toward the
    // initial requirements, so mastery is never demonstrated
    const allRetention = fullBundle().map((e) => ({ ...e, mode: 'retention_check' as const }));
    const r = evaluateConceptualMastery(allRetention, EQUIV);
    expect(r.state).toBe('NOT_YET_DEMONSTRATED');
    expect(r.eligibleCount).toBe(0);
  });

  // E3 — a delayed check that REPEATS a family seen by independence is not fresh
  // retention evidence; it must be an unseen family.
  it('a delayed check reusing an ALREADY-SEEN family does not confirm retention', () => {
    const repeat = {
      ...delayedEvent('2026-10-09T10:00:00Z', 'retention_check'),
      itemFamilyId: 'v1',
    };
    const r = evaluateConceptualMastery([...fullBundle(), repeat], EQUIV);
    expect(r.state).toBe('INDEPENDENT');
  });

  // E4 / R6 — transfer sequencing is NOT a mastery gate; mode IS required.
  it('a transfer recorded before reasoning still counts (no ordering gate)', () => {
    const events: ConceptualEvidence[] = [
      ev('model', true, { rep: 'area-model', family: 'm1', day: 1 }),
      ev('value', true, { rep: 'symbolic', family: 'v1', day: 1 }),
      ev('value', true, { rep: 'area-model', family: 'v2', day: 2 }),
      ev('transfer', true, { mode: 'transfer_check', rep: 'number-line', family: 't1', day: 1 }),
      ev('reasoning', true, { rep: 'symbolic', family: 'r1', day: 2 }),
    ];
    expect(evaluateConceptualMastery(events, EQUIV).state).toBe('INDEPENDENT');
  });

  it('a transfer-dimension event NOT in transfer_check mode does not count', () => {
    const events: ConceptualEvidence[] = [
      ev('model', true, { rep: 'area-model', family: 'm1', day: 1 }),
      ev('value', true, { rep: 'symbolic', family: 'v1', day: 1 }),
      ev('value', true, { rep: 'area-model', family: 'v2', day: 2 }),
      ev('reasoning', true, { rep: 'symbolic', family: 'r1', day: 2 }),
      // a transfer item answered as an ordinary independent check — not a transfer_check
      ev('transfer', true, { mode: 'independent_check', rep: 'number-line', family: 't1', day: 2 }),
    ];
    const r = evaluateConceptualMastery(events, EQUIV);
    expect(r.state).toBe('NOT_YET_DEMONSTRATED');
    expect(r.dimensions.find((d) => d.dimension === 'transfer')!.met).toBe(false);
  });

  // R7 / E5 — optional grade gate excludes grade-crossing evidence and the
  // grade used is recorded on the result.
  it('grade gate excludes evidence tagged to another grade and records the grade', () => {
    const bundle = fullBundle(); // all gradeTarget 5
    const g5 = evaluateConceptualMastery(bundle, EQUIV, { gradeTarget: 5 });
    expect(g5.state).toBe('INDEPENDENT');
    expect(g5.gradeTarget).toBe(5);
    expect(evaluateConceptualMastery(bundle, EQUIV, { gradeTarget: 3 }).state).toBe('UNKNOWN');
    // without the gate, grade is not filtered and no grade is recorded
    const ungated = evaluateConceptualMastery(bundle, EQUIV);
    expect(ungated.state).toBe('INDEPENDENT');
    expect(ungated.gradeTarget).toBeNull();
  });
});
