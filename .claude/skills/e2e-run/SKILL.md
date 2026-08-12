---
name: e2e-run
description: Execute the approved API and browser tests, collect evidence and classify failures provisionally. Triggered by /e2e run.
---

# e2e-run

**Role:** execute and collect evidence. Do not perform final report consolidation or speculative root-cause analysis.

**Load first:** `../_shared/core.md`.
**Load when needed:** `../_shared/references/flaky-taxonomy.md`, `../_shared/references/quality-gate.md`, `../_shared/project-notes.md`.

**Input:** `<slug>` or `cases/<slug>/cases.yaml`.
**Output:** raw engine reports plus merged `reports/<slug>/report.md` evidence; analysis should remain provisional until `e2e-flaky` and `e2e-report`.

## Steps

1. Run API steps with `pnpm e2e:run cases/<slug>/cases.yaml`.
2. If browser steps exist, run `E2E_OUTDIR=reports/<slug> pnpm e2e:browser cases/<slug>/browser/<slug>.spec.ts`. If login is missing, use `/e2e login <target>` rather than inventing credentials.
3. Read `report.json`, browser attachments and console evidence. Merge browser results by case ID.
4. For a repair, use `pnpm e2e:retry` or a single-case `-g` run. Never rerun the full suite merely to check one selector/fix. Probe a suspected selector first.
5. Classify failures provisionally:
   - `[NEEDS-SELECTOR-REVIEW]` → spec/environment;
   - business assertion failure → candidate feature defect;
   - intermittent → flaky candidate;
   - setup failure → dependent tests are SKIPPED/not verified, not feature failures.
6. Never claim an environment outage from console output alone. Verify it directly and quote the check.
7. Preserve evidence paths (`artifacts/`, trace, HTML report) and the exact failing case IDs for the next stage.

## Boundary with report

`e2e-run` may add concise evidence needed to understand a failure, but it must not own the final bug narrative, CSV judgement, or consolidated status. Those belong to `e2e-report` after flaky triage.

## Completion check

`report.json` exists; API/browser layers that apply to the task have run; every failure has a case ID and evidence; and setup failures are distinguished from test failures.
