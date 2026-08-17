---
name: e2e-data
description: Prepare concrete, traceable test data and setup/teardown values for an approved E2E plan. Triggered by /e2e data.
---

# e2e-data

**Role:** make every approved case executable with concrete data. Do not change coverage or business expectations here.

**Load first:** `../_shared/core.md`, `../_shared/references/test-oracle.md`.
**Load when needed:** `../_shared/references/quality-gate.md`, `../_shared/references/automation-ladder.md`, `../_shared/references/field-validation.md`, `../_shared/project-notes.md`.

**Input:** `<slug>` with `plan.md` or `cases.yaml` present. In `/e2e-full`, the approved plan is the normal input.

**Output:** `cases/<slug>/data.md`, written in Vietnamese; update approved yaml/spec values in place.

## Steps

1. **Grep the compiled `cases.yaml`/spec for `[UNVERIFIED]`.** `e2e-gen` tags every literal expect value it copied straight from an observation (see its Compile step) rather than computed — this list is the mandatory starting checklist, not optional cleanup. Every one of these must resolve to `derived` or `anchor` before this stage is done; none may be left tagged `[UNVERIFIED]`, and none may be silently accepted as "already concrete" just because it has a number in it.
2. Read the approved plan and cases. List the remaining concrete data each case needs beyond the `[UNVERIFIED]` list above.
3. Prefer real existing data when the case is read-only and the data genuinely exists.
4. For created/typed values, generate unique, traceable values using the field-validation reference. Cover positive, boundary and negative variants required by the plan.
5. For missing state, follow `automation-ladder.md` and known chains in `project-notes.md`. Express reachable setup as `phase: setup` and cleanup as `phase: teardown`; never mark a reachable state manual merely because the project notes are empty.
6. Flag every mutation with cleanup. For non-deletable records such as orders, follow `automation-ladder.md`'s "Records that cannot be deleted" — prefer seeded read-only assertions and document the choice.
7. For every value an assertion will check — the *expected result*, not the input, including every `[UNVERIFIED]` value from step 1 — decide ownership pattern and oracle strength per `test-oracle.md` **before** picking the value itself: does this case mutate shared state (own the lifecycle, restore in teardown) or only read it (live baseline, nothing to restore)? Is the expected value `derived` or `anchor`? Don't silently downgrade a case the plan committed to `derived` into `anchor` because deriving it is inconvenient — flag it back instead.
8. Write `data.md` as:

`| Case | Field | Value | Kind | Source | Cleanup |`

`Kind` is free text for setup/input data (entity id, account/group id, request payload). For an expected-result value, `Kind` must be `derived` or `anchor` (definitions and traps in `test-oracle.md`), with the reasoning traceable in `Source`.
9. Populate concrete values in `cases.yaml` and browser specs without changing the approved scenario or expected result. Replace every `[UNVERIFIED]` marker with the resolved `# derived: ...` or `# anchor: giá trị mốc, chưa verify công thức` comment — this is the step that actually removes the tag, not just data.md documenting it.

## Completion check

No `[UNVERIFIED]` marker remains anywhere in `cases.yaml` or the browser spec; every required field has a concrete source; every mutation has cleanup or an explicit non-deletable strategy; data variants match the approved coverage; every expected-result value is labeled `derived` or `anchor` with its reasoning traceable in `Source`; every expected value depending on shared/real/mutable data is read live at run time rather than hard-coded from a recon snapshot (or the format gap blocking that is flagged, not silently worked around); and `data.md` exists.
