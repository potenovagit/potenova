import { describe, it, expect } from 'vitest';
import { pluralize, checkEnglishTask } from '../src';

describe('pluralize (regular rules)', () => {
  it('adds -s for the base case', () => {
    expect(pluralize('dog')).toBe('dogs');
    expect(pluralize('book')).toBe('books');
  });
  it('adds -es after a sibilant', () => {
    expect(pluralize('box')).toBe('boxes');
    expect(pluralize('dish')).toBe('dishes');
    expect(pluralize('bus')).toBe('buses');
  });
  it('turns consonant + y into -ies, but keeps vowel + y', () => {
    expect(pluralize('baby')).toBe('babies');
    expect(pluralize('key')).toBe('keys');
  });
});

describe('checkEnglishTask', () => {
  it('accepts the correct plural and rejects a wrong one', () => {
    expect(
      checkEnglishTask({ kind: 'noun_plural', word: 'box', claimedPlural: 'boxes' }).correct,
    ).toBe(true);
    expect(
      checkEnglishTask({ kind: 'noun_plural', word: 'box', claimedPlural: 'boxs' }).correct,
    ).toBe(false);
  });
  it('is case-insensitive on the answer', () => {
    expect(
      checkEnglishTask({ kind: 'noun_plural', word: 'baby', claimedPlural: 'BABIES' }).correct,
    ).toBe(true);
  });
  it('flags a malformed (non-word) task without claiming correctness', () => {
    const r = checkEnglishTask({ kind: 'noun_plural', word: 'b0x', claimedPlural: 'boxes' });
    expect(r.ran).toBe(false);
    expect(r.correct).toBe(false);
    expect(r.reason).toBe('MALFORMED_TASK');
  });
});
