# ER-03 conceptual-mastery evidence pack — er03-1792700240095

- **When:** 2026-10-22T20:17:20.095Z
- **Policy:** `er03-fractions-g3g5-CANDIDATE-v0.2` (approved: false — CANDIDATE, advisory)
- **Dataset:** synthetic (no child, no model; correctness from the content's own answer keys)
- **Result:** 6/6 PASS — the gate holds for every authored (skill × grade) set

Each authored probe set is run twice: a CORRECT run (every probe answered correctly → expect INDEPENDENT) and a WRONG-REASONING run (the reasoning probe answered with a misconception distractor, all else correct → expect NOT_YET_DEMONSTRATED with the reasoning dimension unmet). This is the property the educator asked to see — a correct final answer with wrong reasoning does not earn conceptual mastery — demonstrated over the probes **as authored**, for both assessed-core skills at Grades 3–5.

| | Skill | Grade | Ontario code(s) | Probes | Correct run | Wrong-reasoning run | Dimensions (correct run) |
|---|-------|-------|-----------------|--------|-------------|---------------------|--------------------------|
| ✅ | SK-FR-equiv | G3 | B1.7 | 5 | INDEPENDENT | NOT_YET_DEMONSTRATED | model 1/1; value 2/2; reasoning 1/1; transfer 1/1 |
| ✅ | SK-FR-equiv | G4 | B1.9 | 5 | INDEPENDENT | NOT_YET_DEMONSTRATED | model 1/1; value 2/2; reasoning 1/1; transfer 1/1 |
| ✅ | SK-FR-equiv | G5 | B1.3 | 5 | INDEPENDENT | NOT_YET_DEMONSTRATED | model 1/1; value 2/2; reasoning 1/1; transfer 1/1 |
| ✅ | SK-FR-compare | G3 | B1.6 | 5 | INDEPENDENT | NOT_YET_DEMONSTRATED | model 1/1; value 2/2; reasoning 1/1; transfer 1/1 |
| ✅ | SK-FR-compare | G4 | B1.5 | 5 | INDEPENDENT | NOT_YET_DEMONSTRATED | model 1/1; value 2/2; reasoning 1/1; transfer 1/1 |
| ✅ | SK-FR-compare | G5 | B1.4 | 5 | INDEPENDENT | NOT_YET_DEMONSTRATED | model 1/1; value 2/2; reasoning 1/1; transfer 1/1 |

Raw synthetic events for every correct run are in `evidence.json` alongside this file — each event is deterministic and reproducible via `npm run er03:evidence`.
