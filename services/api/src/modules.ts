/**
 * Bounded-domain module registry for the modular monolith (ADR-0001).
 * Source: Architecture §2 "Bounded domains and ownership".
 *
 * WP-00 only declares the module boundaries and ownership. None of these expose
 * a child-facing endpoint yet — that is gated behind WP-01+ and the safety,
 * validation and consent machinery (CLAUDE.md: "Do not generate a production
 * child-facing endpoint in WP-00").
 */
export interface DomainModule {
  readonly key: string;
  readonly name: string;
  /** Highest data classification the module is authoritative for. */
  readonly dataClass: 'Internal' | 'Confidential' | 'Highly Sensitive Child Data';
  readonly criticality: 'highest' | 'high' | 'standard';
}

export const DOMAIN_MODULES: readonly DomainModule[] = [
  { key: 'identity', name: 'Identity & Family', dataClass: 'Confidential', criticality: 'highest' },
  {
    key: 'privacy',
    name: 'Privacy & Data Governance',
    dataClass: 'Highly Sensitive Child Data',
    criticality: 'highest',
  },
  { key: 'curriculum', name: 'Curriculum & Knowledge', dataClass: 'Internal', criticality: 'high' },
  {
    key: 'evidence',
    name: 'Learning Evidence',
    dataClass: 'Highly Sensitive Child Data',
    criticality: 'highest',
  },
  {
    key: 'learner-state',
    name: 'Learner State',
    dataClass: 'Highly Sensitive Child Data',
    criticality: 'highest',
  },
  {
    key: 'diagnostic',
    name: 'Assessment / Diagnostic',
    dataClass: 'Highly Sensitive Child Data',
    criticality: 'high',
  },
  {
    key: 'tutoring',
    name: 'Tutoring & Session Planning',
    dataClass: 'Highly Sensitive Child Data',
    criticality: 'high',
  },
  { key: 'content', name: 'Content', dataClass: 'Confidential', criticality: 'high' },
  {
    key: 'ai-gateway',
    name: 'AI Orchestration',
    dataClass: 'Confidential',
    criticality: 'highest',
  },
  {
    key: 'safety',
    name: 'Child Safety',
    dataClass: 'Highly Sensitive Child Data',
    criticality: 'highest',
  },
  {
    key: 'parent',
    name: 'Parent Experience',
    dataClass: 'Highly Sensitive Child Data',
    criticality: 'high',
  },
  {
    key: 'billing',
    name: 'Billing & Entitlements',
    dataClass: 'Confidential',
    criticality: 'high',
  },
  {
    key: 'analytics',
    name: 'Analytics & Admin',
    dataClass: 'Confidential',
    criticality: 'standard',
  },
  {
    key: 'support',
    name: 'Support & Operations',
    dataClass: 'Confidential',
    criticality: 'standard',
  },
];
