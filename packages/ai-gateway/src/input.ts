import { DomainError } from '@potenova/contracts';

/**
 * Multimodal input seam — speech-to-text and OCR (ADR-0005; residency triad).
 *
 * The child's voice and uploaded work are turned into text through a provider
 * that runs in a Canadian region (Azure AI Speech / Document Intelligence). Like
 * the generative seam, the real adapter is wired later; this is the interface
 * plus an offline stub, and it is SYNTHETIC-ONLY until consent + residency +
 * ER-16 clear — a non-synthetic request fails closed.
 *
 * Every result carries a recognition confidence; the caller applies the AT-28
 * trust floor (low confidence is never used for a confident grade).
 */
export interface RecognitionResult {
  readonly text: string;
  /** 0..1 recognition certainty. */
  readonly confidence: number;
  readonly model: string;
  /** Canadian region the recognition ran in (residency). */
  readonly region: string;
}

export interface TranscribeRequest {
  readonly audioRef: string;
  readonly synthetic: boolean;
}
export interface ExtractTextRequest {
  readonly imageRef: string;
  readonly synthetic: boolean;
}

export interface InputProvider {
  readonly id: string;
  readonly region: string;
  transcribe(req: TranscribeRequest): Promise<RecognitionResult>;
  extractText(req: ExtractTextRequest): Promise<RecognitionResult>;
}

function assertSynthetic(synthetic: boolean): void {
  if (!synthetic) {
    throw new DomainError('POLICY_BLOCKED', 'input provider accepts synthetic media only');
  }
}

/**
 * Deterministic offline stub — returns a scripted transcript + confidence, never
 * touches the network. Tests set the text/confidence to drive the trust floor.
 */
export class StubInputProvider implements InputProvider {
  readonly id: string;
  readonly region: string;
  readonly #text: string;
  readonly #confidence: number;

  constructor(opts: { text: string; confidence: number; id?: string; region?: string }) {
    this.#text = opts.text;
    this.#confidence = opts.confidence;
    this.id = opts.id ?? 'stub-input';
    this.region = opts.region ?? 'ca-central';
  }

  async transcribe(req: TranscribeRequest): Promise<RecognitionResult> {
    assertSynthetic(req.synthetic);
    return { text: this.#text, confidence: this.#confidence, model: this.id, region: this.region };
  }

  async extractText(req: ExtractTextRequest): Promise<RecognitionResult> {
    assertSynthetic(req.synthetic);
    return { text: this.#text, confidence: this.#confidence, model: this.id, region: this.region };
  }
}
