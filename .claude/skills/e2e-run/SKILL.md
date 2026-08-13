---
name: e2e-run
description: Execute the approved API and browser tests, collect evidence and classify failures provisionally. Triggered by /e2e run.
---

# e2e-run

**Role:** execute and collect evidence. Do not perform final report consolidation or speculative root-cause analysis.

**Load first:** `../_shared/core.md`.
**Load when needed:** `../_shared/references/flaky-taxonomy.md`, `../_shared/references/quality-gate.md`, `../_shared/project-notes.md`.

**Input:** `<slug>` or `cases/<slug>/cases.yaml`.
**Output:** canonical `reports/<slug>/data/report.json`, raw API/browser evidence, and generated evidence projections — all under `data/`. `reports/<slug>/report.html` is seeded automatically (placeholder bug section) and `data/analysis.md` remains tester-owned after its initial seed.

## Steps

1. Run the integrated executor: `pnpm e2e:all <slug>`. It performs blocking preflight, API execution, browser execution when present, and canonical result merging. **Launch it as a real backgrounded run (`run_in_background: true`, or `Monitor` with an until-loop watching the log/report file) and wait for the completion signal.** Do not manually poll a log file with repeated `tail` + fixed-delay-wakeup cycles — a multi-minute browser suite turns that into a dozen+ throwaway round trips that cost tokens and time without adding information. One wait, one check when it actually finishes.
2. If login is missing, stop and use `/e2e login <target>` rather than inventing credentials. Do not bypass a blocking doctor failure.
3. Read `reports/<slug>/data/report.json`, `data/api-report.json`, `data/browser-report.json`, `data/artifacts/`, trace and console evidence. Treat `report.json` as the execution source of truth.
4. For a repair, use `pnpm e2e:retry` or a targeted `-g` run. Never rerun the full suite merely to check one selector/fix — this holds even when **several** cases failed in the same round: batch every case being fixed into one `-g "TD-01|TD-07|TD-12"`-style regex so one retry invocation verifies all of them together, instead of a fresh full suite. Probe a suspected selector first.
5. Classify failures provisionally:
   - `[NEEDS-SELECTOR-REVIEW]` → spec/environment;
   - business assertion failure → candidate feature defect;
   - intermittent → flaky candidate;
   - setup failure → dependent tests are SKIPPED/not verified, not feature failures.
6. Never claim an environment outage from console output alone. Verify it directly and quote the check.
7. Preserve evidence paths (`data/artifacts/`, trace, Playwright's `data/html/index.html`) and exact failing case IDs for the next stage.

## Boundary with report

`e2e-run` may add concise evidence needed to understand a failure, but it must not own the final bug narrative, CSV judgement, or consolidated status. Those belong to `e2e-report` after flaky triage.

## Completion check

`reports/<slug>/data/report.json` exists; applicable API/browser layers have run; every failure has a case ID and evidence; and setup failures are distinguished from test failures.
