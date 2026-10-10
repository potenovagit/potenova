import { DomainError } from '@potenova/contracts';

/**
 * Cost-event envelopes (WP-04).
 * Source: AI-006 (cost guardrails, no child-facing hard cutoff); C-32; TM-24/39;
 * AT-40. CostEvents carry privacy-safe aliases ONLY — never raw child content.
 *
 * The per-session budget below is an ER-01 / NFR-14 DRAFT placeholder (unit
 * economics are derived from the beta), isolated so recalibration is a config
 * change. Exceeding it raises an admin anomaly and prefers a cheaper approved
 * route — it NEVER cuts a child off mid-learning (AI-006).
 */
export const DRAFT_SESSION_COST_BUDGET = 1.0; // placeholder units — ER-01/NFR-14, NOT approved

export interface CostEvent {
  readonly eventId: string;
  readonly familyAlias: string;
  readonly learnerAlias: string;
  readonly sessionId: string;
  readonly capability: string;
  readonly provider: string;
  readonly model: string;
  readonly units: number;
  readonly estimatedCost: number;
}

/** Keys that would indicate raw child content leaking into finance analytics. */
const FORBIDDEN_KEYS = ['content', 'transcript', 'prompt', 'rawText', 'answer'];

/** C-32 / TM-24: reject any cost payload carrying raw child content. */
export function assertCostPayloadClean(payload: Record<string, unknown>): void {
  for (const k of Object.keys(payload)) {
    if (FORBIDDEN_KEYS.includes(k)) {
      throw new DomainError('POLICY_BLOCKED', 'cost events must not carry raw child content');
    }
  }
}

export class CostLedger {
  readonly #budget: number;
  readonly #bySession = new Map<string, number>();
  readonly #events: CostEvent[] = [];

  constructor(sessionBudget: number = DRAFT_SESSION_COST_BUDGET) {
    this.#budget = sessionBudget;
  }

  /** Record a cost envelope; returns whether the session is now over budget. */
  record(event: CostEvent): { readonly event: CostEvent; readonly overBudget: boolean } {
    assertCostPayloadClean(event as unknown as Record<string, unknown>);
    const total = (this.#bySession.get(event.sessionId) ?? 0) + event.estimatedCost;
    this.#bySession.set(event.sessionId, total);
    this.#events.push(Object.freeze({ ...event }));
    return { event, overBudget: total > this.#budget };
  }

  sessionTotal(sessionId: string): number {
    return this.#bySession.get(sessionId) ?? 0;
  }

  events(): readonly CostEvent[] {
    return this.#events.slice();
  }
}
