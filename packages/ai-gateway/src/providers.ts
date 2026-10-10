/**
 * Provider abstraction + test double (WP-04).
 * Source: AI-004 (provider independence); Delivery §5 (test doubles); S-09.
 *
 * The gateway talks to providers only through this interface, so no real model
 * is called in tests — the synthetic harness runs entirely on the test double.
 * A real Azure/self-hosted adapter (ADR-0005) implements the same interface.
 */
export interface ProviderInvocation {
  readonly capability: string;
  readonly ageBand: string;
  readonly subject: string;
  /** True ONLY for synthetic/de-identified evaluation data. */
  readonly synthetic: boolean;
}

export interface ProviderResult {
  readonly ok: boolean;
  readonly units: number;
}

export interface ProviderAdapter {
  readonly id: string;
  readonly region: string;
  invoke(input: ProviderInvocation): ProviderResult;
}

/** Deterministic, offline test double — never touches the network. */
export class TestDoubleProvider implements ProviderAdapter {
  readonly id: string;
  readonly region: string;
  readonly #unitsPerCall: number;

  constructor(id = 'test-double', region = 'ca-central', unitsPerCall = 10) {
    this.id = id;
    this.region = region;
    this.#unitsPerCall = unitsPerCall;
  }

  invoke(_input: ProviderInvocation): ProviderResult {
    return { ok: true, units: this.#unitsPerCall };
  }
}
