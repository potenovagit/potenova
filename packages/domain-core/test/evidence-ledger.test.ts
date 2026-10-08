import { describe, it, expect } from 'vitest';
import { EvidenceLedger, type EvidenceEvent } from '@potenova/domain-core';
import { type ActorContext, isDomainError } from '@potenova/contracts';

const producer: ActorContext = {
  actorType: 'evidence_producer',
  actorAlias: 'ep-1',
  familyAlias: 'F-1',
  learnerAlias: 'L-1',
  purpose: 'evidence_projection',
};
const parent: ActorContext = { ...producer, actorType: 'guardian', purpose: 'parent_reporting' };

const ev = (id: string): EvidenceEvent => ({
  eventId: id,
  learnerAlias: 'L-1',
  skillId: 'SK-1',
  assistanceBand: 'A0',
  recognitionConfidence: 0.98,
  schemaVersion: 'evidence-1',
});

describe('append-only evidence ledger (LRN-003, AT-06, C-07/08)', () => {
  it('appends immutable events from a trusted producer', () => {
    const l = new EvidenceLedger();
    l.append(producer, ev('e1'));
    expect(l.eventCount()).toBe(1);
  });

  it('rejects direct writes by a parent (TM-07)', () => {
    const l = new EvidenceLedger();
    try {
      l.append(parent, ev('e1'));
      throw new Error('expected FORBIDDEN_ROLE');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('FORBIDDEN_ROLE');
    }
  });

  it('is idempotent on replayed eventId (AT-27 at-most-once)', () => {
    const l = new EvidenceLedger();
    l.append(producer, ev('e1'));
    l.append(producer, ev('e1'));
    expect(l.eventCount()).toBe(1);
  });

  it('corrects by appending, never mutating history (AT-06/AT-25)', () => {
    const l = new EvidenceLedger();
    l.append(producer, ev('e1'));
    l.correct(producer, { correctionId: 'c1', targetEventId: 'e1', reason: 'disputed marking' });
    const h = l.history();
    expect(h).toHaveLength(2);
    expect(h[0]?.kind).toBe('event');
    expect(h[1]?.kind).toBe('correction');
    expect(l.eventCount()).toBe(1); // original event remains, unmutated
  });

  it('refuses a correction targeting an unknown event', () => {
    const l = new EvidenceLedger();
    try {
      l.correct(producer, { correctionId: 'c1', targetEventId: 'missing', reason: 'x' });
      throw new Error('expected NOT_FOUND');
    } catch (e) {
      expect(isDomainError(e) && e.code).toBe('NOT_FOUND');
    }
  });
});
