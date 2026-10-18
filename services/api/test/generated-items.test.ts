import { describe, it, expect } from 'vitest';
import { trueRelation, areEquivalent, pluralize } from '@potenova/content';
import {
  resolveTask,
  gateTask,
  generatedTaskId,
  seedFromSession,
  GEN_SERVABLE,
  present,
  judge,
  tokenValid,
} from '../src/task-bank';

/**
 * Wiring the deterministic item stream into the coaching/diagnostic loop:
 * a generated task id round-trips to the same gradable item without stored state,
 * passes the content gate, and grades correctly. Unsupported kinds are refused.
 */

describe('generated item stream in the loop', () => {
  const seed = seedFromSession('session-abc');

  it('seedFromSession is stable and deterministic', () => {
    expect(seedFromSession('session-abc')).toBe(seed);
    expect(seedFromSession('session-xyz')).not.toBe(seed);
  });

  it('resolves a generated fraction-comparison id to a gated, gradable task', () => {
    const id = generatedTaskId('SK-FR-compare', 0, seed, 'core');
    const task = gateTask(id); // content gate passes for a valid generated item
    expect(task.skillId).toBe('SK-FR-compare');
    const { options } = present(task);
    expect(options).toEqual(['lt', 'eq', 'gt']);
    // the correct answer grades correct; a wrong one grades wrong
    if (task.kind === 'fraction_comparison') {
      const truth = trueRelation(task.left, task.right);
      expect(judge(task, truth)).toBe(true);
      const wrong = truth === 'eq' ? 'lt' : 'eq';
      expect(judge(task, wrong)).toBe(false);
    }
  });

  it('resolves the same id to the same task every time (no stored state)', () => {
    const id = generatedTaskId('SK-FR-equiv', 2, seed, 'core');
    const a = resolveTask(id);
    const b = resolveTask(id);
    expect(a).toEqual(b);
    if (a.kind === 'fraction_equivalence') {
      expect(judge(a, areEquivalent(a.left, a.right) ? 'yes' : 'no')).toBe(true);
    }
  });

  it('resolves a generated plural id and grades the learner token', () => {
    const id = generatedTaskId('SK-EN-plural-sibilant', 0, seed, 'stretch');
    const task = gateTask(id);
    expect(task.skillId).toBe('SK-EN-plural-sibilant');
    if (task.kind === 'noun_plural') {
      const right = pluralize(task.word);
      expect(tokenValid(task, right)).toBe(true);
      expect(judge(task, right)).toBe(true);
      expect(judge(task, `${task.word}s`)).toBe(pluralize(task.word) === `${task.word}s`);
    }
  });

  it('refuses a generated id for a skill not servable in the loop yet', () => {
    const id = generatedTaskId('SK-FR-number-line', 0, seed, 'core');
    expect(() => resolveTask(id)).toThrow();
    expect(GEN_SERVABLE['SK-FR-number-line']).toBeUndefined();
  });

  it('a static bank id still resolves (back-compat)', () => {
    const task = resolveTask('frac-cmp-1');
    expect(task.skillId).toBe('SK-FR-compare');
  });

  it('an unknown static id throws NOT_FOUND', () => {
    expect(() => resolveTask('does-not-exist')).toThrow();
  });

  it('binds the remaining fraction skills: deliverable, gradable, course-matched', () => {
    const skills = [
      'SK-FR-partition',
      'SK-FR-unit',
      'SK-FR-nonunit',
      'SK-FR-numberline',
      'SK-FR-order',
    ];
    for (const skillId of skills) {
      expect(GEN_SERVABLE[skillId]).toMatchObject({ subject: 'math', course: 'fractions' });
      const id = generatedTaskId(skillId, 0, seed, 'core');
      const task = gateTask(id); // content gate passes
      expect(task.skillId).toBe(skillId);
      expect(present(task).question.length).toBeGreaterThan(0);

      // the correct answer grades correct; a clearly-wrong valid token grades wrong
      let correct = '';
      let wrong = '';
      if (task.kind === 'fraction_partition') {
        correct = `${task.shaded}/${task.parts}`;
        wrong = `0/${task.parts}`;
      } else if (task.kind === 'fraction_unit') {
        correct = `1/${task.denominator}`;
        wrong = `2/${task.denominator}`;
      } else if (task.kind === 'fraction_nonunit_build') {
        correct = `${task.count}/${task.unitDenominator}`;
        wrong = `1/${task.unitDenominator}`; // count >= 2
      } else if (task.kind === 'fraction_number_line') {
        const tick = (task.fraction.numerator * task.intervals) / task.fraction.denominator;
        correct = `${tick}`;
        wrong = `${tick === 0 ? 1 : 0}`;
      } else if (task.kind === 'fraction_order') {
        const idx = task.fractions.map((_, i) => i);
        const asc = [...idx].sort((x, y) => {
          const r = trueRelation(task.fractions[x]!, task.fractions[y]!);
          return r === 'lt' ? -1 : r === 'gt' ? 1 : 0;
        });
        correct = asc.map((i) => i + 1).join(',');
        wrong = [...asc]
          .reverse()
          .map((i) => i + 1)
          .join(',');
      }
      expect(tokenValid(task, correct)).toBe(true);
      expect(judge(task, correct)).toBe(true);
      expect(judge(task, wrong)).toBe(false);
    }
  });
});
