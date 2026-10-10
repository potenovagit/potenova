import { DomainError } from '@potenova/contracts';
import type { IncidentSeverity, IncidentStream } from './policy';

/**
 * Unified incident management (OPS-004/008; SAFE-013).
 *
 * One severity-based queue spans technical, educational, AI, child-safety,
 * privacy and security streams. A record carries severity, ownership, impact,
 * containment, communications and RCA. A material AI-safety incident cannot close
 * (and its capability cannot be re-enabled) until an RCA and a regression case
 * are attached (SAFE-013).
 */

export type IncidentState = 'OPEN' | 'CONTAINED' | 'RESOLVED' | 'CLOSED';

export interface Incident {
  readonly incidentId: string;
  readonly stream: IncidentStream;
  readonly severity: IncidentSeverity;
  readonly owner: string;
  readonly state: IncidentState;
  readonly rcaAttached: boolean;
  readonly regressionCaseId: string | null;
}

export function openIncident(input: {
  readonly incidentId: string;
  readonly stream: IncidentStream;
  readonly severity: IncidentSeverity;
  readonly owner: string;
}): Incident {
  return { ...input, state: 'OPEN', rcaAttached: false, regressionCaseId: null };
}

export function containIncident(i: Incident): Incident {
  if (i.state !== 'OPEN')
    throw new DomainError('CONFLICT', 'only an OPEN incident can be contained');
  return { ...i, state: 'CONTAINED' };
}

export function attachRca(i: Incident, regressionCaseId: string): Incident {
  return { ...i, rcaAttached: true, regressionCaseId };
}

/**
 * Close an incident. A child-safety or AI incident requires an RCA + regression
 * case before closure/re-enablement (SAFE-013).
 *
 * @throws DomainError REVIEW_REQUIRED — RCA/regression missing where required.
 */
export function closeIncident(i: Incident): Incident {
  const mustHaveRegression = i.stream === 'child_safety' || i.stream === 'ai';
  if (mustHaveRegression && (!i.rcaAttached || !i.regressionCaseId)) {
    throw new DomainError(
      'REVIEW_REQUIRED',
      'RCA and a regression case are required before closing this incident',
    );
  }
  if (i.state === 'OPEN') {
    throw new DomainError('CONFLICT', 'incident must be contained/resolved before closing');
  }
  return { ...i, state: 'CLOSED' };
}
