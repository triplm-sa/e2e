---
name: e2e-report
description: Consolidate the latest run of a task into report.md and export report.csv for Google Sheets, Jira or TestRail. Triggered by /e2e report.
---

# e2e-report

Consolidate a task's latest results and export a machine-readable summary.

Shared conventions: `../_shared/conventions.md`.

**Input:** `<slug>`, with `reports/<slug>/report.json` present. If it is missing, run `/e2e run` first.

**Output:** `reports/<slug>/report.md` and `reports/<slug>/report.csv` — **written in Vietnamese** (see the language policy in conventions); CSV column headers stay in English for tool compatibility.

## Steps

1. Read `reports/<slug>/report.json`, plus the existing `report.md` when it already carries an analysis.

2. Update or write `reports/<slug>/report.md`: the per-case result table keyed by case id, the analysis section, and links to `html/index.html` and the screenshots in `artifacts/`.

3. Export `reports/<slug>/report.csv` with the columns `TC ID, Case, Target, Risk, Status, Detail, Type`, where `Type` is one of `feature`, `spec` or `flaky`. Keep the ids identical to the plan, yaml and spec so results can be traced back.

4. Summarise for the tester: total pass and fail counts, the **distribution across risk ratings**, and a clear split between **cases that need a developer** (genuine feature defects) and **cases that need a spec review** (`[NEEDS-SELECTOR-REVIEW]` or flaky).
