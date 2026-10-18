import { describe, it, expect } from 'vitest';
import {
  pastTenseRegular,
  comparativeRegular,
  checkEnglishTask,
  generateEnglishItems,
  gateGeneratedEnglishItems,
  generateDeliverableEnglishItems,
  supportsEnglishSkill,
  ENGLISH_GENERATOR_ID,
  type GeneratedEnglishItem,
} from '@potenova/content';

/**
 * English item generator (ADR-0026). Rule-decidable morphology turned into many
 * items, each forced through the independent oracle + LOCKED content-gate. No model.
 */

describe('english morphology oracle', () => {
  it('regular past tense covers the rule branches', () => {
    expect(pastTenseRegular('walk')).toBe('walked'); // + ed
    expect(pastTenseRegular('play')).toBe('played'); // vowel + y keeps
    expect(pastTenseRegular('hope')).toBe('hoped'); // drop-e → d
    expect(pastTenseRegular('stop')).toBe('stopped'); // CVC double
    expect(pastTenseRegular('carry')).toBe('carried'); // consonant-y → ied
  });

  it('regular comparative covers the rule branches', () => {
    expect(comparativeRegular('tall')).toBe('taller');
    expect(comparativeRegular('slow')).toBe('slower'); // w is not a doubling consonant
    expect(comparativeRegular('nice')).toBe('nicer'); // drop-e → r
    expect(comparativeRegular('big')).toBe('bigger'); // CVC double
    expect(comparativeRegular('happy')).toBe('happier'); // consonant-y → ier
  });

  it('oracle marks a wrong key WRONG and a non-word MALFORMED', () => {
    expect(
      checkEnglishTask({ kind: 'regular_past_tense', verb: 'stop', claimedPast: 'stoped' }),
    ).toMatchObject({ correct: false, ran: true, reason: 'ANSWER_KEY_WRONG' });
    expect(
      checkEnglishTask({
        kind: 'comparative_adjective',
        adjective: 'big',
        claimedComparative: 'big2',
      }),
    ).toMatchObject({ ran: false, reason: 'MALFORMED_TASK' });
  });
});

describe('english item generator', () => {
  const skills = [
    'SK-EN-plural-base',
    'SK-EN-plural-sibilant',
    'SK-EN-past-regular',
    'SK-EN-comparative',
  ];

  it('generates distinct items for every supported skill, all gated to DELIVER', () => {
    for (const skillId of skills) {
      expect(supportsEnglishSkill(skillId)).toBe(true);
      const items = generateEnglishItems(skillId, 6, 3, 'stretch');
      expect(items.length).toBeGreaterThan(0);
      expect(new Set(items.map((i) => JSON.stringify(i.task))).size).toBe(items.length); // distinct
      const gated = gateGeneratedEnglishItems(items);
      expect(gated.every((g) => g.outcome.kind === 'DELIVER')).toBe(true);
      expect(gated.every((g) => g.record.verdict === 'PASS')).toBe(true);
    }
  });

  it('is deterministic by seed', () => {
    const a = generateEnglishItems('SK-EN-past-regular', 5, 9, 'stretch');
    const b = generateEnglishItems('SK-EN-past-regular', 5, 9, 'stretch');
    expect(a).toEqual(b);
  });

  it('throws for an unsupported skill rather than faking items', () => {
    expect(supportsEnglishSkill('SK-EN-essay')).toBe(false);
    expect(() => generateEnglishItems('SK-EN-essay', 3)).toThrow(/unsupported/);
  });

  it('BLOCKS an item whose key is wrong (AT-20, fail-closed)', () => {
    const good = generateEnglishItems('SK-EN-past-regular', 1, 1, 'stretch')[0]!;
    expect(good.task.kind).toBe('regular_past_tense');
    const corrupted: GeneratedEnglishItem = {
      ...good,
      candidateId: 'gen:corrupt:en',
      task: { kind: 'regular_past_tense', verb: 'stop', claimedPast: 'stoped' },
    };
    const [g] = gateGeneratedEnglishItems([corrupted]);
    expect(g.record.verdict).toBe('FAIL');
    expect(g.outcome.kind).toBe('BLOCK');
  });

  it('refuses to let the generator validate its own output (TM-10)', () => {
    const items = generateEnglishItems('SK-EN-comparative', 2, 5);
    expect(() => gateGeneratedEnglishItems(items, ENGLISH_GENERATOR_ID)).toThrow(/independent/);
  });

  it('generateDeliverableEnglishItems returns only cleared items', () => {
    const deliverable = generateDeliverableEnglishItems('SK-EN-plural-sibilant', 8, 2, 'stretch');
    expect(deliverable.length).toBeGreaterThan(0);
    expect(deliverable.every((g) => g.outcome.kind === 'DELIVER')).toBe(true);
  });
});
