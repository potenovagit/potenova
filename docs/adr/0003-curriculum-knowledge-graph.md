# ADR-0003: Curriculum / prerequisite knowledge-graph representation

- **Status:** Proposed (for WP-00 approval gate G0)
- **Date:** 2026-10-08
- **Deciders:** Curriculum / Learning
- **Requirement IDs:** LRN-007 (versioned canonical skill graph, typed weighted edges),
  CUR domain (17 reqs), CurriculumRelease/CanonicalSkill/SkillDependency entities,
  AT-08 (prerequisite traversal), AT-50 (edition/mapping update)
- **Decision class:** IMPLEMENTATION DECISION

## Context

Curriculum is a **versioned graph**: `CanonicalSkill` nodes (stable across curriculum
editions) with **typed, weighted** `SkillDependency` edges (hardPrerequisite / strong /
supporting / transfer), plus `CurriculumExpectation` → skill mappings that are themselves
versioned and review-controlled. Traversals are prerequisite lookups and coverage queries
over a few thousand nodes at MVP scope, not web-scale graph analytics.

## Options considered

1. **Native graph database.** Pro: expressive traversals. Con: a second datastore to make
   Canada-resident, back up, and DR-test; operational overhead unjustified at MVP graph size.
   **Rejected for MVP.**
2. **Graph modelled in the primary PostgreSQL** (`canonical_skill`, `skill_dependency`,
   `expectation_skill_map` tables) with recursive CTEs for prerequisite traversal, everything
   **versioned** with effective dates. Pro: one store, residency/backup/DR already solved;
   mappings and edges get the same review/version controls as the rest of the model; edition
   changes create new versions without rewriting history (AT-50). Con: very deep traversals are
   less ergonomic than a native graph — acceptable at this scale. **Chosen.**

## Decision

Represent the curriculum graph **relationally in PostgreSQL**, versioned, with typed/weighted
edges and recursive-CTE traversal. A thin `curriculum` module exposes graph queries; the
canonical graph is **append/version-controlled** and AI may only _propose_ candidate edges
(never mutate the canonical graph — Master §12, TM-42/43).

## Consequences

- No extra datastore; curriculum versioning and historical-evidence binding are consistent
  with ADR-0002.
- **Reversal/revisit trigger:** multi-jurisdiction expansion (Grades 9–12, other provinces,
  French) that makes traversal/maintenance costly justifies a dedicated graph engine behind
  the `curriculum` module contract.

## Compliance / verification

Graph-integrity, traversal and mapping-version tests land in WP-02; canonical-graph
immutability (no unreviewed edge promotion) is a contract test at the module boundary.
