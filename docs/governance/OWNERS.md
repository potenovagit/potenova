# Potenova — Accountable Owners (GOV-001)

**As of 2026-10-09.** GOV-001 requires a named accountable owner for every
governance role, and RTEST-GOV-001 checks that no release gate lacks an
accountable approver. Governance §7 permits one person to hold multiple roles
for an initial small team, provided none is left blank.

| Role                             | Accountable owner |
| -------------------------------- | ----------------- |
| Product                          | Cristian Miron    |
| Curriculum / educational quality | Cristian Miron    |
| AI Governance                    | Cristian Miron    |
| Child Safety                     | Cristian Miron    |
| Privacy                          | Cristian Miron    |
| Security                         | Cristian Miron    |
| Operations                       | Cristian Miron    |

**Arrangement:** single accountable owner (sole founder/operator) for all roles,
to be split as staff are added. This satisfies GOV-001 for internal
accountability and unblocks the gate record.

## Signoffs that require an INDEPENDENT party (cannot be self-signed)

The accountable owner is responsible for commissioning these; they cannot be
satisfied by the owner acting as the reviewer:

- **SEC-005** — independent third-party penetration test before paid/public (G3).
- **GOV-003 / GOV-004 / ER-10 / ER-07** — external legal & privacy counsel for the
  PIA, child-consent regime and data-retention determinations, before G2 beta.
- **ER-03 / NFR-08 (CUR human-review)** — independent educator review of mastery
  thresholds and the curriculum mapping, before G2.
- **High-stakes verification** — safety/privacy-critical review performed by a
  reviewer (or separate agent) that did not produce the work under review.
