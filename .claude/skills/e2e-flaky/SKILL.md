---
name: e2e-flaky
description: Triage failing or intermittent cases, distinguish feature defects from spec/environment problems, and optionally stabilise cases with bounded targeted repair. Triggered by /e2e flaky.
---

# e2e-flaky

**Role:** determine whether a failing case is stable, flaky, spec-related or a genuine feature defect, then apply bounded stabilisation when requested.

**Load first:** `../_shared/core.md`, `../_shared/references/test-oracle.md`.
**Load when needed:** `../_shared/references/flaky-taxonomy.md`, `../_shared/references/quality-gate.md`.

**Input:** `<slug>` with `reports/<slug>/data/report.json` present.

**Mode:**
- standalone `/e2e flaky <slug>` → analyze only;
- standalone `/e2e flaky <slug> fix` → propose fixes and wait for confirmation before editing;
- orchestrated by `/e2e-full` → fix mode is **pre-authorized for this workflow** and must not ask for another approval.

## Targeted healing strategy

Never rerun the whole suite merely because one case failed.

1. Select only failing/intermittent **test** cases from `report.json`; setup/environment failures are not healing candidates.
2. Re-run only the affected case(s) in isolation using `pnpm e2e:retry <slug> "<id>"` or a targeted Playwright `-g` run. For API cases, rerun the relevant API case directly.
3. If the failure is caused by a shared fixture, setup, or state mutation, expand the rerun scope only to the smallest dependent group and explain why.
4. For locator suspicion, run `pnpm e2e:probe` before editing. For hangs, diagnose the innermost timeout instead of increasing it.
5. Classify each case with `flaky-taxonomy.md`:
   - intermittent → flaky/spec/environment candidate;
   - `[NEEDS-SELECTOR-REVIEW]` → spec/environment;
   - consistent business assertion failure → feature defect candidate — but first recompute the expectation from current inputs per the AC's rule: if the app's value satisfies the rule and only the stored literal is out of date, this is `Stale expectation` (convert to live baseline), not a defect;
   - setup failure → not verified, not a feature defect.
6. In standalone `fix` mode, present the proposed fix list and wait for confirmation. In `/e2e-full`, skip this confirmation because the orchestrator already authorised bounded healing.
7. Apply only evidence-backed fixes. After each fix, rerun the smallest affected scope. A repaired case must pass **twice consecutively** before it is considered stable.
   **Never launder a regression by rebaselining an `anchor` expected value** (see `test-oracle.md`) to whatever the app currently shows — that requires the same evidence a new bug report would, not just "the test now agrees with the app". A `derived` value that starts failing is a stronger defect signal — treat it as a feature-defect candidate, not a stabilisation target.
8. If a repaired shared fixture can affect multiple cases, run the impacted group once after the targeted double-pass rather than immediately rerunning the entire suite.
9. Stop early when all selected failures are stable, when a business-rule contradiction appears, or after **five repair rounds** in one orchestrated run.
10. Before the final report, `/e2e-full` performs one full-suite verification through `e2e-run` only when a fix changed executable code/spec/fixture or shared setup. If no fix was applied, do not rerun already-passing cases.

## Evidence

Preserve retry evidence under `reports/<slug>/data/retry/`; never overwrite the canonical `report.json`. Keep exact case IDs, retry counts, evidence paths and the reason for any scope expansion.

Update the failure analysis in `reports/<slug>/data/analysis.md` with category, evidence and recommended action — do not touch `report.html` directly, `e2e-report` rebuilds it from this file. Do not rewrite the final consolidated report beyond the classification needed by the next stage.

## Completion check

Every selected failure has a category and evidence; any applied fix has verification; no `anchor` value was rebaselined without independent proof it's now correct; flaky cases are either stable after two consecutive passes or explicitly exhausted at five rounds; and the final full-suite verification is performed only when a repair can affect other cases.
