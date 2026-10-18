import { describe, it, expect } from 'vitest';
import {
  generateItems,
  gateGeneratedItems,
  generateDeliverableItems,
  supportsSkill,
  GENERATOR_ID,
  trueRelation,
  type GeneratedItem,
} from '@potenova/content';

/**
 * Deterministic item generator (ADR-0024). Turns one skill into many items, with
 * every item forced through the independent oracle + LOCKED content-gate. No model.
 */

describe('item generator', () => {
  it('generates the requested number of distinct items for a supported skill', () => {
    const items = generateItems('SK-FR-compare', 12, 7);
    expect(items).toHaveLength(12);
    const keys = items.map((i) => JSON.stringify(i.task));
    expect(new Set(keys).size).toBe(12); // all distinct
    expect(items.every((i) => i.skillId === 'SK-FR-compare')).toBe(true);
    expect(items.every((i) => i.generatorId === GENERATOR_ID)).toBe(true);
  });

  it('is deterministic — same seed yields identical items', () => {
    const a = generateItems('SK-FR-equiv', 10, 42);
    const b = generateItems('SK-FR-equiv', 10, 42);
    expect(a).toEqual(b);
    const c = generateItems('SK-FR-equiv', 10, 43);
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(a)); // different seed differs
  });

  it('sets every comparison answer key to the oracle ground truth', () => {
    for (const i of generateItems('SK-FR-compare', 30, 3)) {
      if (i.task.kind === 'fraction_comparison') {
        expect(i.task.claimedAnswer).toBe(trueRelation(i.task.left, i.task.right));
      }
    }
  });

  it('throws for an unsupported skill rather than faking items', () => {
    expect(supportsSkill('SK-FR-partition')).toBe(false);
    expect(() => generateItems('SK-FR-partition', 5)).toThrow(/unsupported/);
  });

  it('gates every generated item to DELIVER with a signed record', () => {
    const gated = gateGeneratedItems(generateItems('SK-FR-compare', 20, 9));
    expect(gated).toHaveLength(20);
    for (const g of gated) {
      expect(g.outcome.kind).toBe('DELIVER');
      expect(g.record.verdict).toBe('PASS');
      expect(g.record.reasonCodes).toContain('MATH_ANSWER_KEY_CORRECT');
    }
  });

  it('BLOCKS an item whose answer key is wrong (AT-20, fail-closed)', () => {
    const good = generateItems('SK-FR-compare', 1, 1)[0]!;
    expect(good.task.kind).toBe('fraction_comparison');
    // Corrupt the key to a deliberately wrong relation.
    const truth = good.task.kind === 'fraction_comparison' ? good.task.claimedAnswer : 'eq';
    const wrong = truth === 'eq' ? 'lt' : 'eq';
    const corrupted: GeneratedItem = {
      ...good,
      candidateId: 'gen:corrupt:1',
      task: {
        ...(good.task as { kind: 'fraction_comparison' } & typeof good.task),
        claimedAnswer: wrong,
      },
    };
    const [g] = gateGeneratedItems([corrupted]);
    expect(g.record.verdict).toBe('FAIL');
    expect(g.record.reasonCodes).toContain('MATH_ANSWER_KEY_WRONG');
    expect(g.outcome.kind).toBe('BLOCK');
  });

  it('refuses to let the generator validate its own output (TM-10)', () => {
    const items = generateItems('SK-FR-equiv', 2, 5);
    expect(() => gateGeneratedItems(items, GENERATOR_ID)).toThrow(/independent/);
  });

  it('generateDeliverableItems returns only cleared items', () => {
    const deliverable = generateDeliverableItems('SK-FR-equiv', 15, 11);
    expect(deliverable.length).toBeGreaterThan(0);
    expect(deliverable.every((g) => g.outcome.kind === 'DELIVER')).toBe(true);
  });

  it('difficulty widens the fraction pool (stretch exceeds intro)', () => {
    const intro = generateItems('SK-FR-compare', 20, 2, 'intro');
    const introMax = Math.max(
      ...intro.flatMap((i) =>
        i.task.kind === 'fraction_comparison'
          ? [i.task.left.denominator, i.task.right.denominator]
          : [],
      ),
    );
    const stretch = generateItems('SK-FR-compare', 20, 2, 'stretch');
    const stretchMax = Math.max(
      ...stretch.flatMap((i) =>
        i.task.kind === 'fraction_comparison'
          ? [i.task.left.denominator, i.task.right.denominator]
          : [],
      ),
    );
    expect(introMax).toBeLessThanOrEqual(4);
    expect(stretchMax).toBeGreaterThan(4);
  });
});
