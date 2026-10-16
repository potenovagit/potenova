import { type Region, isApprovedRegion, DomainError } from '@potenova/contracts';

/**
 * Environment + residency configuration.
 * Source: SEC-002 (strong dev/test/staging/prod separation; no prod child data
 * in non-prod); B9 Canadian region boundary; OPS/Architecture residency rules.
 *
 * Config is validated fail-closed at process start. There are no secrets here —
 * secrets are injected per environment (see .env.example) and never committed.
 */

export const ENVIRONMENTS = ['dev', 'test', 'qa', 'staging', 'prod'] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export interface PotenovaConfig {
  readonly environment: Environment;
  readonly primaryRegion: Region;
  readonly drRegion: Region;
  /**
   * Hard guarantee surfaced in config so it is testable: production child data
   * may never be present outside `prod`. Non-prod uses synthetic fixtures only.
   */
  readonly allowRealChildData: boolean;
}

function parseEnvironment(v: string | undefined): Environment {
  if (v && (ENVIRONMENTS as readonly string[]).includes(v)) return v as Environment;
  throw new DomainError('POLICY_BLOCKED', `invalid NODE_ENV/APP_ENV: ${String(v)}`);
}

function parseRegion(name: string, v: string | undefined): Region {
  if (v && isApprovedRegion(v)) return v;
  throw new DomainError('REGION_DISALLOWED', `${name} must be a Canada-resident region`);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): PotenovaConfig {
  const environment = parseEnvironment(env.APP_ENV ?? env.NODE_ENV);
  const primaryRegion = parseRegion('PRIMARY_REGION', env.PRIMARY_REGION ?? 'ca-central');
  const drRegion = parseRegion('DR_REGION', env.DR_REGION ?? 'ca-east');

  // Invariant: only prod may ever carry real child data (SEC-002).
  const allowRealChildData = environment === 'prod';

  if (primaryRegion === drRegion) {
    throw new DomainError('POLICY_BLOCKED', 'DR region must differ from primary region');
  }

  return { environment, primaryRegion, drRegion, allowRealChildData };
}
