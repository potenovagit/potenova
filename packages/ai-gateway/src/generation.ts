import { DomainError } from '@potenova/contracts';

/**
 * Generative-provider seam (ADR-0005; AI-003/004).
 *
 * The gateway calls a real model only through this interface, and only on the
 * candidate-evaluation path (`AIGateway.routeForEvaluation`) with SYNTHETIC data.
 * A real Azure OpenAI adapter and an offline stub both implement it, so tests
 * never touch the network and production never wires a model into a child path
 * without going through the gateway's residency/approval guards first.
 */
export interface GenerativeRequest {
  readonly system?: string;
  readonly prompt: string;
  readonly maxOutputTokens?: number;
  readonly temperature?: number;
}

export interface GenerativeResult {
  readonly text: string;
  readonly model: string;
  /** Total tokens, for cost accounting. */
  readonly units: number;
}

export interface GenerativeProvider {
  readonly id: string;
  /** Canadian region the provider runs in (residency); checked by the gateway. */
  readonly region: string;
  generate(req: GenerativeRequest): Promise<GenerativeResult>;
}

export interface AzureOpenAiConfig {
  /** e.g. https://oai-potenova-digitery.openai.azure.com */
  readonly endpoint: string;
  /** Deployment name, e.g. tutor-mini. */
  readonly deployment: string;
  readonly apiKey: string;
  /** Canadian region of the resource (residency), e.g. ca-east. */
  readonly region: string;
  readonly apiVersion?: string;
  readonly id?: string;
}

/**
 * Real Azure OpenAI chat adapter. Calls a Regional (in-Canada) deployment over
 * HTTPS. Used only for candidate evaluation on synthetic data until ER-16 clears.
 */
export class AzureOpenAiChatProvider implements GenerativeProvider {
  readonly id: string;
  readonly region: string;
  readonly #endpoint: string;
  readonly #deployment: string;
  readonly #apiKey: string;
  readonly #apiVersion: string;

  constructor(cfg: AzureOpenAiConfig) {
    this.id = cfg.id ?? `azure-openai:${cfg.deployment}`;
    this.region = cfg.region;
    this.#endpoint = cfg.endpoint.replace(/\/+$/, '');
    this.#deployment = cfg.deployment;
    this.#apiKey = cfg.apiKey;
    this.#apiVersion = cfg.apiVersion ?? '2024-10-21';
  }

  async generate(req: GenerativeRequest): Promise<GenerativeResult> {
    const url = `${this.#endpoint}/openai/deployments/${this.#deployment}/chat/completions?api-version=${this.#apiVersion}`;
    const messages: { role: string; content: string }[] = [];
    if (req.system) messages.push({ role: 'system', content: req.system });
    messages.push({ role: 'user', content: req.prompt });

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'api-key': this.#apiKey },
        body: JSON.stringify({
          messages,
          temperature: req.temperature ?? 0,
          max_tokens: req.maxOutputTokens ?? 600,
        }),
      });
    } catch {
      throw new DomainError('DEPENDENCY_UNAVAILABLE', 'AI provider unreachable');
    }
    if (!res.ok) {
      throw new DomainError('DEPENDENCY_UNAVAILABLE', `AI provider HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { total_tokens?: number };
    };
    return {
      text: data.choices?.[0]?.message?.content ?? '',
      model: this.id,
      units: data.usage?.total_tokens ?? 0,
    };
  }
}

/** Deterministic, offline stub — returns scripted text, never touches the network. */
export class StubGenerativeProvider implements GenerativeProvider {
  readonly id: string;
  readonly region: string;
  readonly #text: string;

  constructor(text: string, opts?: { id?: string; region?: string }) {
    this.#text = text;
    this.id = opts?.id ?? 'stub-generator';
    this.region = opts?.region ?? 'ca-east';
  }

  async generate(_req: GenerativeRequest): Promise<GenerativeResult> {
    return { text: this.#text, model: this.id, units: 1 };
  }
}
