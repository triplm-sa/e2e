---
name: e2e-run
description: Execute a task — API steps via pnpm e2e:run, browser specs via pnpm e2e:browser — then merge the results and analyse each failure down to file:line in reports/<slug>/report.md. Triggered by /e2e run.
---

# e2e-run

Execute one task. **Input lives in `cases/<slug>/`; every output goes to `reports/<slug>/`.**

Shared conventions and prerequisites: `../_shared/conventions.md`.

**Input:** `<slug>` (the task folder name) or a path to `cases/<slug>/cases.yaml`.

**Output:** `reports/<slug>/report.md` — the table and machine reports are produced by the engine; the analysis section you write is **in Vietnamese** (see the language policy in conventions).

## Steps

1. Run the API layer: `cd e2e && pnpm e2e:run cases/<slug>/cases.yaml`. This produces the API results and `reports/<slug>/report.md`. Note that `e2e:run` executes only `target: api` steps and skips browser steps, which run in the next step.

2. If the task has browser steps: `cd e2e && E2E_OUTDIR=reports/<slug> pnpm e2e:browser cases/<slug>/browser/<slug>.spec.ts`. The target must be logged in — run `/e2e login <target>` first if the session is missing or expired. Screenshots land in `reports/<slug>/artifacts/` and the browsable report in `reports/<slug>/html/index.html`.

3. Read `reports/<slug>/report.json` and the console attachments, then merge the browser results into `report.md`, matching rows by case id. Point the tester at `html/index.html` and the images in `artifacts/`; a trace file needs `pnpm exec playwright show-trace <file>` to open.

4. **Analyse every failure** in the report's analysis section, citing `file:line`. Classify each one using `../_shared/references/flaky-taxonomy.md`:
   - A message containing `[NEEDS-SELECTOR-REVIEW]` is a **spec or environment** problem — suggest `/e2e recon` or a spec review, and do not report a feature defect.
   - Only a failure in a **business assertion** (no such prefix) indicates a **genuine feature defect** — trace it into the source.
   - Intermittent results → hand over to `/e2e flaky`.

5. Summarise for the tester: pass and fail counts, notable console errors, and the suspected cause of each failure. To export CSV or re-consolidate, use `/e2e report`.
