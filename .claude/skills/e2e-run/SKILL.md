---
name: e2e-run
description: Execute the approved API and browser tests, collect evidence and classify failures provisionally. Triggered by /e2e run.
---

# e2e-run

**Role:** execute and collect evidence. Do not perform final report consolidation or speculative root-cause analysis.

**Load first:** `../_shared/core.md`.
**Load when needed:** `../_shared/references/flaky-taxonomy.md`, `../_shared/references/quality-gate.md`, `../_shared/project-notes.md`.

**Input:** `<slug>` or `cases/<slug>/cases.yaml`.
**Output:** canonical `reports/<slug>/report.json`, raw API/browser evidence, and generated evidence projections. `report.md` remains tester-owned after its initial seed.

## Steps

1. Run the integrated executor: `pnpm e2e:all <slug>`. It performs blocking preflight, API execution, browser execution when present, and canonical result merging.
2. If login is missing, stop and use `/e2e login <target>` rather than inventing credentials. Do not bypass a blocking doctor failure.
3. Read `reports/<slug>/report.json`, `api-report.json`, `browser-report.json`, artifacts, trace and console evidence. Treat `report.json` as the execution source of truth.
4. For a repair, use `pnpm e2e:retry` or a single-case `-g` run. Never rerun the full suite merely to check one selector/fix. Probe a suspected selector first.
5. Classify failures provisionally:
   - `[NEEDS-SELECTOR-REVIEW]` → spec/environment;
   - business assertion failure → candidate feature defect;
   - intermittent → flaky candidate;
   - setup failure → dependent tests are SKIPPED/not verified, not feature failures.
6. Never claim an environment outage from console output alone. Verify it directly and quote the check.
7. Preserve evidence paths (`artifacts/`, trace, HTML report) and exact failing case IDs for the next stage.

## Boundary with report

`e2e-run` may add concise evidence needed to understand a failure, but it must not own the final bug narrative, CSV judgement, or consolidated status. Those belong to `e2e-report` after flaky triage.

## Completion check

`reports/<slug>/report.json` exists; applicable API/browser layers have run; every failure has a case ID and evidence; and setup failures are distinguished from test failures.
