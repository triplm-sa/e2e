---
name: e2e-data
description: Prepare concrete, traceable test data and setup/teardown values for an approved E2E plan. Triggered by /e2e data.
---

# e2e-data

**Role:** make every approved case executable with concrete data. Do not change coverage or business expectations here.

**Load first:** `../_shared/core.md`.
**Load when needed:** `../_shared/references/quality-gate.md`, `../_shared/references/automation-ladder.md`, `../_shared/references/field-validation.md`, `../_shared/project-notes.md`.

**Input:** `<slug>` with `plan.md` or `cases.yaml` present. In `/e2e-full`, the approved plan is the normal input.

**Output:** `cases/<slug>/data.md`, written in Vietnamese; update approved yaml/spec values in place.

## Steps

1. Read the approved plan and cases. List the concrete data each case needs.
2. Prefer real existing data when the case is read-only and the data genuinely exists.
3. For created/typed values, generate unique, traceable values using the field-validation reference. Cover positive, boundary and negative variants required by the plan.
4. For missing state, follow `automation-ladder.md` and known chains in `project-notes.md`. Express reachable setup as `phase: setup` and cleanup as `phase: teardown`; never mark a reachable state manual merely because the project notes are empty.
5. Flag every mutation with cleanup. For non-deletable records such as orders, prefer seeded read-only assertions and document the choice.
6. Write `data.md` as:

`| Case | Field | Value | Kind | Source | Cleanup |`

7. Populate concrete values in `cases.yaml` and browser specs without changing the approved scenario or expected result.

## Completion check

Every required field has a concrete source; every mutation has cleanup or an explicit non-deletable strategy; data variants match the approved coverage; and `data.md` exists.
