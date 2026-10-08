/**
 * The 32 logical command/query contracts (business semantics, not HTTP routes).
 * Source: 04_Logical_Contracts_Events_Sequences.md.
 *
 * Registered here as a machine-checkable catalogue so that service wiring and
 * the requirement-trace tooling can assert every contract has a named owning
 * domain. Physical transport/schema remain an IMPLEMENTATION DECISION (ADR-0005).
 */
export interface LogicalContract {
  readonly id: string;
  readonly owner: string;
  readonly name: string;
}

export const LOGICAL_CONTRACTS: readonly LogicalContract[] = [
  { id: 'C-01', owner: 'Identity', name: 'CreateFamily' },
  { id: 'C-02', owner: 'Privacy', name: 'RecordGuardianConsent' },
  { id: 'C-03', owner: 'Identity', name: 'CreateLearner' },
  { id: 'C-04', owner: 'Identity', name: 'StartChildSession' },
  { id: 'C-05', owner: 'Diagnostic', name: 'StartDiagnostic' },
  { id: 'C-06', owner: 'Diagnostic', name: 'NextTask' },
  { id: 'C-07', owner: 'Tutoring', name: 'SubmitAttempt' },
  { id: 'C-08', owner: 'LearnerEvidence', name: 'AppendEvidence' },
  { id: 'C-09', owner: 'LearnerModel', name: 'ProjectShadow' },
  { id: 'C-10', owner: 'LearnerModel', name: 'PromoteProjection' },
  { id: 'C-11', owner: 'Planner', name: 'ProposeSession' },
  { id: 'C-12', owner: 'Planner', name: 'ReviseSession' },
  { id: 'C-13', owner: 'AI', name: 'GenerateInstruction' },
  { id: 'C-14', owner: 'Validation', name: 'CheckContent' },
  { id: 'C-15', owner: 'AI', name: 'DeliverTutorTurn' },
  { id: 'C-16', owner: 'Ingestion', name: 'StartUpload' },
  { id: 'C-17', owner: 'Ingestion', name: 'ExtractSchoolEvidence' },
  { id: 'C-18', owner: 'Parent', name: 'ConfirmSchoolEvidence' },
  { id: 'C-19', owner: 'Parent', name: 'SetSchoolPriority' },
  { id: 'C-20', owner: 'Tutoring', name: 'ChallengeMarking' },
  { id: 'C-21', owner: 'Quality', name: 'ResolveChallenge' },
  { id: 'C-22', owner: 'Billing', name: 'ApplyProviderEvent' },
  { id: 'C-23', owner: 'Billing', name: 'ResolveEntitlement' },
  { id: 'C-24', owner: 'Billing', name: 'AdjustServiceCredit' },
  { id: 'C-25', owner: 'Privacy', name: 'ExportLearner' },
  { id: 'C-26', owner: 'Privacy', name: 'DeleteLearner' },
  { id: 'C-27', owner: 'ChildSafety', name: 'Triage' },
  { id: 'C-28', owner: 'Support', name: 'OpenCase' },
  { id: 'C-29', owner: 'Operations', name: 'RouteAIModel' },
  { id: 'C-30', owner: 'Operations', name: 'QuarantineAsset' },
  { id: 'C-31', owner: 'Governance', name: 'ReleaseApprove' },
  { id: 'C-32', owner: 'Analytics', name: 'RecordCost' },
];
