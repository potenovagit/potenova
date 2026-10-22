import { trueRelation, type Fraction } from './math-check';

/**
 * Stage-2 Workstream-B automated pool-validation gate (NFR-07 pre-check).
 *
 * A standing, deterministic gate that must pass before an assessment pool is
 * frozen for the Stage-2 benchmark. It re-derives every assessed-core gold key
 * by EXACT integer arithmetic (never a model, never floats), and enforces the
 * structural rules the educator/owner sign-off relies on: one correct option,
 * tagged distractors, valid curriculum codes per skill×grade, per-cell coverage,
 * chronological-novelty feasibility, and honest approval state.
 *
 * This is an ENGINEERING gate. Passing it is necessary, not sufficient: it does
 * not replace the human approver-of-record sign-off, only guarantees the pool is
 * internally sound and its keys are arithmetically correct before a human signs.
 * Synthetic/authoring content only; nothing here is delivered to a child.
 */

export const APPROVED_MISCONCEPTIONS = [
  'MC-FR-denom-size',
  'MC-FR-unequal-parts',
  'MC-FR-different-wholes',
  'MC-FR-whole-number-compare',
  'MC-FR-equiv-scale-one',
  'MC-FR-equiv-additive',
  'MC-FR-surface-feature',
  'MC-FR-equiv-missed',
  'MC-FR-nonequiv-assumed',
] as const;
export type MisconceptionId = (typeof APPROVED_MISCONCEPTIONS)[number];

export const POOL_REPRESENTATIONS = ['area-model', 'number-line', 'set-model', 'symbolic'] as const;
export const POOL_MODES = ['independent_check', 'transfer_check'] as const;
export type PoolDimension = 'model' | 'value' | 'reasoning' | 'transfer';

/** Expected Ontario expectation code per assessed-core skill×grade. */
const EXPECTED_CODE: Record<string, string> = {
  'SK-FR-equiv:3': 'B1.7',
  'SK-FR-equiv:4': 'B1.9',
  'SK-FR-equiv:5': 'B1.3',
  'SK-FR-compare:3': 'B1.6',
  'SK-FR-compare:4': 'B1.5',
  'SK-FR-compare:5': 'B1.4',
};
const ASSESSED_CORE = new Set(['SK-FR-equiv', 'SK-FR-compare']);

export interface PoolOption {
  readonly id: string;
  readonly text: string;
  readonly correct?: boolean;
  readonly misconceptionId?: string;
}
export interface PoolMathCheck {
  readonly left: string;
  readonly right: string;
  readonly relation: string; // equal | greater | left_gt | less | right_gt
  readonly true: boolean;
}
export interface PoolItem {
  readonly itemId: string;
  readonly itemFamilyId: string;
  readonly skillId: string;
  readonly gradeTarget: number;
  readonly dimension: PoolDimension;
  readonly sourceExpectationCode: string;
  readonly curriculumRelationship?: string;
  readonly representation: string;
  readonly mode: string;
  readonly options: readonly PoolOption[];
  readonly goldKey?: string;
  readonly goldVerification?: { readonly mathCheck?: PoolMathCheck | string };
}
export interface AssessmentPool {
  readonly poolVersion?: string;
  readonly items: readonly PoolItem[];
}

export type FindingSeverity = 'error' | 'warning';
export interface PoolFinding {
  readonly severity: FindingSeverity;
  readonly itemId: string;
  readonly code: string;
  readonly message: string;
}
export interface CellCoverage {
  readonly cell: string;
  readonly families: number;
  readonly model: number;
  readonly value: number;
  readonly valueFamilies: number;
  readonly reasoning: number;
  readonly transfer: number;
  readonly meetsQuota: boolean;
}
export interface PoolValidationReport {
  readonly ok: boolean; // no errors (warnings allowed)
  readonly errors: number;
  readonly warnings: number;
  readonly findings: readonly PoolFinding[];
  readonly coverage: readonly CellCoverage[];
  readonly positionBalance: Readonly<Record<string, number>>;
  readonly goldKeysVerified: number;
}

function parseFraction(s: string): Fraction | null {
  const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(s);
  if (!m) return null;
  return { numerator: Number(m[1]), denominator: Number(m[2]) };
}

/** Verify an item's gold mathCheck by exact arithmetic: does the claimed
 *  `true` match the real relation? Returns null if not checkable. */
export function verifyMathCheck(mc: PoolMathCheck): boolean | null {
  const L = parseFraction(mc.left);
  const R = parseFraction(mc.right);
  if (!L || !R) return null;
  const rel = trueRelation(L, R); // 'lt' | 'eq' | 'gt'
  let computed: boolean;
  switch (mc.relation) {
    case 'equal':
      computed = rel === 'eq';
      break;
    case 'greater':
    case 'left_gt':
    case 'left_greater':
      computed = rel === 'gt';
      break;
    case 'less':
    case 'smaller':
    case 'right_gt':
    case 'right_greater':
      computed = rel === 'lt';
      break;
    default:
      return null;
  }
  return computed === mc.true;
}

const g5LiteralDenomOver12 = (mc: PoolMathCheck): string | null => {
  for (const s of [mc.left, mc.right]) {
    const parts = String(s).split('/');
    if (parts.length === 2 && Number(parts[1]) > 12) return s;
  }
  return null;
};

/**
 * Validate an assessment pool. Deterministic; returns a structured report with
 * errors (block freeze) and warnings (resolve-before-freeze advisories).
 */
export function validateAssessmentPool(pool: AssessmentPool): PoolValidationReport {
  const findings: PoolFinding[] = [];
  const err = (itemId: string, code: string, message: string) =>
    findings.push({ severity: 'error', itemId, code, message });
  const warn = (itemId: string, code: string, message: string) =>
    findings.push({ severity: 'warning', itemId, code, message });

  const items = pool.items ?? [];
  const familyCounts = new Map<string, number>();
  for (const it of items)
    familyCounts.set(it.itemFamilyId, (familyCounts.get(it.itemFamilyId) ?? 0) + 1);
  for (const [fam, n] of familyCounts)
    if (n > 1) err('POOL', 'duplicate-family', `itemFamilyId '${fam}' used ${n}×`);

  const position: Record<string, number> = {};
  let goldKeysVerified = 0;

  type Cell = {
    families: Set<string>;
    dims: Record<string, number>;
    valueFamilies: Set<string>;
    transferFams: Set<string>;
    nonTransferFams: Set<string>;
  };
  const cells = new Map<string, Cell>();
  const cellOf = (it: PoolItem) => `${it.skillId} G${it.gradeTarget}`;

  for (const it of items) {
    const id = it.itemId;
    const correct = it.options.filter((o) => o.correct);
    if (correct.length !== 1) {
      err(id, 'one-correct', `expected exactly 1 correct option, found ${correct.length}`);
    } else {
      if (it.goldKey !== undefined && it.goldKey !== correct[0]!.id)
        err(id, 'goldkey-mismatch', `goldKey ${it.goldKey} != correct option ${correct[0]!.id}`);
      position[correct[0]!.id] = (position[correct[0]!.id] ?? 0) + 1;
    }
    for (const o of it.options) {
      if (!o.correct) {
        if (!o.misconceptionId)
          warn(id, 'untagged-distractor', `distractor ${o.id} has no misconceptionId`);
        else if (!(APPROVED_MISCONCEPTIONS as readonly string[]).includes(o.misconceptionId))
          err(
            id,
            'bad-misconception',
            `distractor ${o.id} misconceptionId '${o.misconceptionId}' not approved`,
          );
      }
    }
    if (!(POOL_REPRESENTATIONS as readonly string[]).includes(it.representation))
      err(id, 'bad-representation', `representation '${it.representation}'`);
    if (!(POOL_MODES as readonly string[]).includes(it.mode))
      err(id, 'bad-mode', `mode '${it.mode}'`);
    if (it.dimension === 'transfer' && it.mode !== 'transfer_check')
      err(id, 'transfer-mode', `transfer item must be transfer_check, is ${it.mode}`);

    const key = `${it.skillId}:${it.gradeTarget}`;
    if (key in EXPECTED_CODE && it.sourceExpectationCode !== EXPECTED_CODE[key])
      err(
        id,
        'curriculum-code',
        `code ${it.sourceExpectationCode} != expected ${EXPECTED_CODE[key]}`,
      );
    if (
      it.skillId === 'SK-FR-equiv' &&
      it.gradeTarget === 4 &&
      it.curriculumRelationship &&
      !it.curriculumRelationship.startsWith('supporting')
    )
      err(id, 'g4-supporting', `G4 B1.9 must be supporting-*, is '${it.curriculumRelationship}'`);

    if (ASSESSED_CORE.has(it.skillId)) {
      const mc = it.goldVerification?.mathCheck;
      if (!mc || typeof mc === 'string') {
        err(id, 'missing-mathcheck', 'assessed-core item lacks structured mathCheck');
      } else {
        const v = verifyMathCheck(mc);
        if (v === null)
          err(
            id,
            'unverifiable-mathcheck',
            `cannot verify relation '${mc.relation}' on ${mc.left}/${mc.right}`,
          );
        else if (!v)
          err(
            id,
            'unsound-goldkey',
            `mathCheck asserts true=${mc.true} but exact arithmetic disagrees for ${mc.left} ${mc.relation} ${mc.right}`,
          );
        else goldKeysVerified++;
        if (it.gradeTarget === 5) {
          const over = g5LiteralDenomOver12(mc);
          if (over)
            warn(
              id,
              'g5-denominator',
              `G5 item uses literal denominator >12 (${over}) vs declared ≤12 subset`,
            );
        }
      }
      const c = cells.get(cellOf(it)) ?? {
        families: new Set(),
        dims: {},
        valueFamilies: new Set(),
        transferFams: new Set(),
        nonTransferFams: new Set(),
      };
      c.families.add(it.itemFamilyId);
      c.dims[it.dimension] = (c.dims[it.dimension] ?? 0) + 1;
      if (it.dimension === 'value') c.valueFamilies.add(it.itemFamilyId);
      if (it.dimension === 'transfer') c.transferFams.add(it.itemFamilyId);
      else c.nonTransferFams.add(it.itemFamilyId);
      cells.set(cellOf(it), c);
    }
  }

  const coverage: CellCoverage[] = [];
  for (const [cell, c] of cells) {
    const model = c.dims['model'] ?? 0;
    const value = c.dims['value'] ?? 0;
    const reasoning = c.dims['reasoning'] ?? 0;
    const transfer = c.dims['transfer'] ?? 0;
    const valueFamilies = c.valueFamilies.size;
    const meetsQuota = model >= 1 && valueFamilies >= 2 && reasoning >= 1 && transfer >= 1;
    if (!meetsQuota)
      err(
        'POOL',
        'coverage',
        `${cell}: model ${model}, value-families ${valueFamilies}, reasoning ${reasoning}, transfer ${transfer} — below quota (model≥1, value≥2 families, reasoning≥1, transfer≥1)`,
      );
    const overlap = [...c.transferFams].filter((f) => c.nonTransferFams.has(f));
    if (overlap.length)
      err(
        'POOL',
        'transfer-reuse',
        `${cell}: transfer family also used by a non-transfer item: ${overlap.join(', ')}`,
      );
    coverage.push({
      cell,
      families: c.families.size,
      model,
      value,
      valueFamilies,
      reasoning,
      transfer,
      meetsQuota,
    });
  }

  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.filter((f) => f.severity === 'warning').length;
  return {
    ok: errors === 0,
    errors,
    warnings,
    findings,
    coverage,
    positionBalance: position,
    goldKeysVerified,
  };
}
