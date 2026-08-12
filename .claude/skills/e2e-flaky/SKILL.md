---
name: e2e-flaky
description: Triage failing or intermittent cases, distinguish feature defects from spec/environment problems, and optionally stabilise cases with bounded repair. Triggered by /e2e flaky.
---

# e2e-flaky

**Role:** determine whether a failing case is stable, flaky, spec-related or a genuine feature defect, then apply bounded stabilisation when requested.

**Load first:** `../_shared/core.md`.
**Load when needed:** `../_shared/references/flaky-taxonomy.md`, `../_shared/references/quality-gate.md`.

**Input:** `<slug>` with `reports/<slug>/report.json` present.

**Mode:**
- standalone `/e2e flaky <slug>` → analyze only;
- standalone `/e2e flaky <slug> fix` → propose fixes and wait for confirmation before editing;
- orchestrated by `/e2e-full` → fix mode is **pre-authorized for this workflow** and must not ask for another approval.

## Steps

1. Select failing/intermittent cases from `report.json`.
2. Re-run only those cases in isolation. Use `pnpm e2e:retry <slug> "<id>"` or a targeted browser run; for API cases rerun the relevant API execution. Never rerun the whole suite for one fix.
3. For locator suspicion, run `pnpm e2e:probe` before editing. For hangs, diagnose the innermost timeout instead of increasing it.
4. Classify each case with `flaky-taxonomy.md`:
   - intermittent → flaky/spec/environment candidate;
   - `[NEEDS-SELECTOR-REVIEW]` → spec/environment;
   - consistent business assertion failure → feature defect candidate;
   - setup failure → not verified, not a feature defect.
5. In standalone `fix` mode, present the proposed fix list and wait for confirmation. In `/e2e-full`, skip this confirmation because the orchestrator already authorised bounded healing.
6. Apply only evidence-backed fixes. Re-verify after each round. Maximum **five repair rounds** in one orchestrated run.
7. A case is stable only after **two consecutive passes**. Stop early when stable, when a business-rule contradiction appears, or after five rounds.
8. Update the failure analysis in `report.md` with category, evidence and recommended action. Do not rewrite the final consolidated report beyond the classification needed by the next stage.

## Completion check

Every selected failure has a category and evidence; any applied fix has verification; flaky cases are either stable after two consecutive passes or explicitly exhausted at five rounds.
