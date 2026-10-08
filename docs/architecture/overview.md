# Potenova Architecture Overview (WP-00)

Technology-neutral invariants come from the v2 baseline; the technology choices are in the
[ADRs](../adr/README.md). Diagrams are Mermaid (diagram-as-code, versioned with the repo).

## 1. Logical component architecture

A **modular monolith** (ADR-0001): one deployable hosting the bounded-domain modules, plus two
isolated workers for the bursty/risky paths (AI routing, media ingestion). Clients share the
`@potenova/contracts` types.

```mermaid
flowchart TB
  subgraph Clients
    W[Web - React]
    M[Mobile - React Native iOS/Android]
  end

  subgraph Edge
    GW[API gateway / BFF\nauthZ, purpose, region, schema]
  end

  subgraph Monolith[Modular monolith - services/api]
    ID[Identity & Family]
    PRIV[Privacy & Data Governance]
    CUR[Curriculum & Knowledge]
    EV[Learning Evidence\nappend-only]
    LS[Learner State\nsole mastery authority]
    DIA[Diagnostic]
    TUT[Tutoring & Planner]
    CON[Content]
    SAFE[Child Safety]
    PAR[Parent Experience]
    BILL[Billing & Entitlements]
    ANA[Analytics & Admin]
    SUP[Support & Ops]
  end

  subgraph Workers[Isolated workers]
    AIGW[AI Gateway worker\nregistry + routing + validation]
    ING[Ingestion/Vision worker\nmalware + prompt-injection isolation]
  end

  subgraph Data[Canadian region data plane]
    PG[(PostgreSQL\nevidence log + projections + graph)]
    OBJ[(Private object store\nexpiring scoped refs)]
    AUD[(Tamper-resistant\nsecurity audit log)]
  end

  subgraph Providers[Approved Canadian-resident providers]
    LLM[LLM - Regional deployment]
    STT[Speech STT/TTS]
    OCR[Vision / Document OCR]
  end

  W --> GW
  M --> GW
  GW --> Monolith
  TUT --> AIGW
  DIA --> AIGW
  ING --> AIGW
  AIGW --> LLM
  ING --> OCR
  TUT --> STT
  Monolith --> PG
  ING --> OBJ
  PRIV --> AUD
  AIGW -. cost events .-> ANA
```

**Key rule shown:** child-facing requests reach a provider **only** via the AI Gateway, which
enforces registry + region + envelope before any call, and content is validated before delivery.

## 2. Domain ownership and canonical entities (ER)

Only **Learner State** may author mastery. Evidence is immutable; state is a projection.

```mermaid
erDiagram
  FamilyAccount ||--o{ LearnerProfile : has
  FamilyAccount ||--o{ GuardianRoleGrant : grants
  FamilyAccount ||--o{ Entitlement : holds
  LearnerProfile ||--o{ ConsentGrant : covered_by
  LearnerProfile ||--o{ EvidenceEvent : produces
  EvidenceEvent ||--o{ EvidenceCorrection : corrected_by
  LearnerProfile ||--o{ LearnerSkillState : projected_as
  CanonicalSkill ||--o{ EvidenceEvent : about
  CanonicalSkill ||--o{ SkillDependency : from
  CurriculumExpectation ||--o{ ExpectationSkillMap : maps
  CanonicalSkill ||--o{ ExpectationSkillMap : mapped_by
  ContentAsset ||--o{ ContentValidation : validated_by
  EvidenceEvent }o--|| LearnerSkillState : "replayed into (projector only)"
```

Ownership boundaries (authoritative owner in parentheses): FamilyAccount/Guardian/Learner
identity (Identity & Family) · ConsentGrant/DataSubjectRequest (Privacy) · Curriculum graph
(Curriculum) · EvidenceEvent/Correction (Learning Evidence) · LearnerSkillState/Misconception
(Learner State) · ContentAsset/Validation (Content) · ModelRegistryEntry/AIInvocation (AI
Governance/Orchestration) · Entitlement/PurchaseTransaction (Billing) · SafetyCase (Child
Safety). Billing and learning histories join only through authorization-controlled aliases, and
every foreign reference enforces the Canadian region boundary.

## 3. Tutor-turn flow — generate → validate → deliver (AI-001)

```mermaid
sequenceDiagram
  autonumber
  participant Child
  participant TUT as Tutoring/Planner
  participant AIGW as AI Gateway
  participant VAL as Independent Validator
  participant EV as Evidence (append-only)
  participant LS as Learner State (projector)

  Child->>TUT: attempt / request (child session)
  TUT->>AIGW: C-13 generate (approved task, minimal context)
  Note over AIGW: fail-closed: region + registry + envelope + no-train
  AIGW-->>TUT: candidate content (NOT deliverable yet)
  TUT->>VAL: C-14 validate (rubric, curriculum, safety)
  alt PASS (signed record)
    VAL-->>TUT: PASS + validationRecordRef
    TUT-->>Child: C-15 deliver validated turn
  else FAIL / UNCERTAIN / UNAVAILABLE
    VAL-->>TUT: not PASS
    TUT-->>Child: approved fallback, or safe block
  end
  TUT->>EV: C-08 append immutable observation (assistance, confidence)
  EV->>LS: C-09 shadow project -> C-10 gated promote (projector only)
```

The tutor **never** writes mastery. It submits evidence; the projector advances state by replay
under a policy version (`mastery-authority`).

## 4. Trust boundaries (B1–B11)

```mermaid
flowchart LR
  subgraph B1[B1 Parent account]
    direction TB
    P[Guardian]
  end
  subgraph B2[B2 Child interface]
    C[Least-priv child session]
  end
  subgraph B3[B3 Model & safety boundary]
    AIc[AI + content validation]
  end
  subgraph B4[B4 Upload/vision]
    U[Ingestion pipeline]
  end
  subgraph B5[B5 Evidence to state]
    E[Projection]
  end
  subgraph B8[B8 Privileged support/incident]
    OPS[JIT, audited access]
  end
  subgraph B9[B9 Canadian region]
    R[Eligible vendors, backups, logs, DR]
  end

  P -->|step-up for sensitive| B2
  C -->|validated only| B3
  U -->|malware + injection isolation| B3
  B3 --> B5
  OPS -.->|zero standing access| B5
  B3 --> B9
  B5 --> B9
```

Full boundary set: B1 parent→family/roles · B2 child→protected learning APIs · B3 child
content→model/safety · B4 uploads→ingestion/vision · B5 evidence→projected state · B6
learning/identity→operational aggregates · B7 purchase channels→entitlement · B8 production
child data→privileged access · B9 Canadian region→eligible vendors/backups/logs/DR · B10 code
release→prod policy/model/content · B11 future B2B context→family context (isolated by default).

## 5. Deployment environments and release flow

Four strongly separated environments (SEC-002), region-pinned to Canada; staged rollout with
flags and kill switches (OPS-003; state machine 3.11).

```mermaid
flowchart LR
  DEV[dev\nsynthetic only] --> TEST[test\nsynthetic only]
  TEST --> STG[staging\nsynthetic/de-identified]
  STG --> PROD[prod - ca-central\nmulti-zone critical]
  PROD -. DR .-> DRR[DR - ca-east\nrestore-tested backups]

  subgraph Release[Release lifecycle 3.11]
    D[DRAFT] --> V[VALIDATED] --> LC[LIMITED_COHORT] --> EX[EXPANDED] --> GA[GENERAL]
    V -. rollback .-> RB[ROLLED_BACK/DISABLED]
    LC -. kill switch .-> RB
  end
```

Only `prod` may hold real child data; non-prod uses synthetic fixtures (`config` enforces this).
Highest-criticality services (identity, safety, consent, evidence integrity, AI validation) run
multi-zone; DR is a second Canadian region (active-active not required at launch).
