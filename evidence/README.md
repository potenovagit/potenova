# Evidence repository

Layout (from `07_Acceptance_NFR_Release_Gates.md` §D):

```
/evidence/<gate>/<requirement-id>/<run-id>/
```

Each run artifact records: test report, **synthetic** fixture IDs, redacted trace, reviewer,
software/model/content/policy versions, date, actual vs expected result, and any
exception/risk approval. **Never** place child content in evidence folders or tickets.

## WP-00 (G0 architecture acceptance)

- `WP-00/requirement-trace.json` — v2 register import + shape gate (276 reqs / 16 domains /
  all LOCKED / WP-00=15). Regenerate: `npm run trace:evidence`.
- Architecture-fitness test results (mastery authority, AI routing, content gate, consent
  fence, evidence immutability) are produced by `npm run test` in CI and uploaded as the
  `wp-00-evidence` artifact.

Gate directories for G1–G4 are created as those gates are approached.
