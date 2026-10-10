import { isApprovedRegion } from '@potenova/contracts';

/**
 * Candidate AI provider registry + residency proof-of-concept (ER-16 / ADR-0005).
 *
 * This is the concrete "slot" a real provider plugs into. Each descriptor states
 * where a provider would run and whether provider-side training is disabled; the
 * residency PoC proves — with code, before any real credentials or spend — that
 * the gateway would admit ONLY a Canadian-resident, training-disabled provider
 * for child data.
 *
 * EVIDENCE REQUIRED (ER-16): `status: 'candidate'` and `trainingDisabled` here are
 * the intended posture, NOT confirmed fact. A descriptor only becomes
 * `'approved'` after Microsoft's (or the vendor's) WRITTEN confirmation of the
 * in-region inference path and the no-retention exemption — an owner action with
 * lead time, not something code can assert. Until then the active adapter stays
 * the offline TestDoubleProvider.
 */
export type ProviderVendor = 'azure_openai' | 'aws_bedrock' | 'self_hosted';
export type ProviderStatus = 'candidate' | 'approved';

export interface ProviderDescriptor {
  readonly id: string;
  readonly vendor: ProviderVendor;
  readonly region: string;
  /** Intended: provider-side training/retention disabled (PRIV-003). */
  readonly trainingDisabled: boolean;
  readonly modalities: readonly ('text' | 'voice' | 'vision')[];
  readonly status: ProviderStatus;
}

/** Candidate paths informing the ER-16 decision — none approved until confirmed. */
export const CANDIDATE_PROVIDERS: readonly ProviderDescriptor[] = [
  {
    id: 'azure-openai-ca-central',
    vendor: 'azure_openai',
    region: 'ca-central',
    trainingDisabled: true,
    modalities: ['text'],
    status: 'candidate',
  },
  {
    id: 'azure-openai-ca-east',
    vendor: 'azure_openai',
    region: 'ca-east',
    trainingDisabled: true,
    modalities: ['text'],
    status: 'candidate',
  },
  {
    id: 'self-hosted-ca-central',
    vendor: 'self_hosted',
    region: 'ca-central',
    trainingDisabled: true,
    modalities: ['text', 'voice', 'vision'],
    status: 'candidate',
  },
];

export interface ResidencyAssessment {
  readonly admissibleForChildData: boolean;
  readonly reasons: readonly string[];
}

/**
 * Residency PoC: would this provider be admissible to process child data?
 * Admissible only when it runs in the Canadian allowlist AND training is
 * disabled. Reason codes only — safe to log.
 */
export function assessProviderResidency(d: ProviderDescriptor): ResidencyAssessment {
  const reasons: string[] = [];
  if (!isApprovedRegion(d.region)) reasons.push('REGION_NOT_CANADIAN');
  if (!d.trainingDisabled) reasons.push('TRAINING_NOT_DISABLED');
  return { admissibleForChildData: reasons.length === 0, reasons };
}

/** Only an explicitly APPROVED (confirmed) provider may carry production child data. */
export function isProviderApprovedForChildData(d: ProviderDescriptor): boolean {
  return d.status === 'approved' && assessProviderResidency(d).admissibleForChildData;
}
