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

2. If the task has browser steps: `cd e2e && E2E_OUTDIR=reports/<slug> pnpm e2e:browser cases/<slug>/browser/<slug>.spec.ts`.

   The target must be logged in — run `/e2e login <target>` first if the session is missing or expired. Screenshots land in `reports/<slug>/artifacts/` and the browsable report in `reports/<slug>/html/index.html`.

   **While repairing a spec, never re-run the whole suite.** A browser suite costs minutes and the fix under test is usually one case: `pnpm e2e:retry <slug>` re-runs only the last run's failures, and `pnpm e2e:retry <slug> TD-07` runs a single case.

   **A retry writes to `reports/<slug>/retry/<n>/`, never over the task's report.** Playwright's html and json reporters overwrite their output folder with exactly what the current invocation ran, so a `--last-failed` run aimed at the task folder used to erase every case that had passed — the HTML then showed a handful of cases and read as though the suite were that small. Each retry now gets its own folder and merges its results into `reports/<slug>/report.json`, newest result per case winning, so the counts always describe the whole task.

   **`reports/<slug>/html/index.html` still shows the last *full* run and does not contain retry results** — Playwright can only produce that HTML from a run, not from merged JSON. So **run the full suite once at the end**: `pnpm e2e:all <slug>`. It also clears the retry folders, since a full run supersedes them. A report presented to the tester on the strength of retries alone has an HTML that disagrees with its own numbers. For a locator failure, check the selector with `pnpm e2e:probe` (seconds) before editing and re-running.

   **When the spec already exists, this is the regression entry point** — `/e2e run <slug>` re-runs everything without invoking `analyze`, `recon` or `gen`. The budget for that path is **five minutes**, and it is only reachable when the spec has parallel describe groups (the hard gate in `e2e-gen` §7); a single-worker spec takes six to eight minutes for the same number of tests. To re-run only the previous run's failures, use `pnpm e2e:retry <slug>`.

3. **Check that every `phase: setup` step succeeded, before reading any other result.** A failed setup has silently cost more than a quarter of a suite before now — those tests never ran at all. When a setup step fails, say so at the very top of the summary: which setup died, why, and which cases therefore went unverified. Never let a suite where a quarter of the tests never executed be presented as a suite that finished. Fix the setup, then re-run only the skipped cases with `pnpm e2e:retry <slug> <case>`, not the whole suite.

4. **If the task has browser steps (step 2 ran):** read `reports/<slug>/report.json` and the console attachments, then merge the browser results into `report.md`, matching rows by case id. Point the tester at `html/index.html` and the images in `artifacts/`; a trace file needs `pnpm exec playwright show-trace <file>` to open.

   **If the task is API-only (step 2 was skipped, no `browser/<slug>.spec.ts`):** `report.json` is never produced — it is emitted only by the Playwright reporters that step 2 invokes. `report.md`/`report.csv` from step 1 already hold the complete result; skip this merge and go straight to step 5.

5. **Analyse every failure** in the report's analysis section, citing `file:line`. Observe the evidence rule in `../_shared/conventions.md`: a console line is a weak signal, messages tagged `NOISE` (browser extension, third-party host) are not evidence about the application, and **any claim that the environment is broken must be backed by a direct check whose output you quote** (`curl` the URL, `pnpm e2e:doctor`, a screenshot of the unrendered page). Where the cause is unclear, say so and list what was ruled out.

   Classify each failure using `../_shared/references/flaky-taxonomy.md`:
   - A message containing `[NEEDS-SELECTOR-REVIEW]` is a **spec or environment** problem — suggest `/e2e recon` or a spec review, and do not report a feature defect.
   - A case tagged `unverifiedSelector: true` in `cases.yaml`, or one whose failure message is a **strict-mode violation** (`resolved to N elements`) or an action timeout on a locator that never became stable, is a **selector problem, not a feature defect** — regardless of whether the failing assertion was a business one. Report these as **not-yet-verified**, the same category as a test whose `phase: setup` never succeeded, and send them back to `/e2e recon` for that route. Classify by **what the failure message actually says**, not by which assertion line happened to trip: in one real run, ten failures all landed on business assertions and would have been filed as product bugs, when every one of them was an unverified selector.
   - Only a failure in a **business assertion** whose locator is verified — the element was found, uniquely, and the value it holds is wrong — indicates a **genuine feature defect**. Trace that one into the source.
   - Intermittent results → hand over to `/e2e flaky`.
   - Steps marked **SKIPPED** were never executed because a `phase: setup` step failed before them. Report them as not-yet-verified and fix the setup; never present them as feature defects. Only `test` steps count towards the pass/fail total.

6. **Write the bug section of the report.** The engine leaves section 1 with a template: one block per bug, covering both newly appeared bugs and previously reported ones re-verified in this run. Each needs the observed behaviour, the expected behaviour with its AC, **numbered steps the tester can reproduce by hand**, the evidence in `artifacts/`, and the suspected `file:line`.

   Keep the report to what the tester acts on. **Do not add sections narrating your own process** — what you automated, how much data you created, incidents while re-running, spec fixes you made along the way. Coverage and data belong in `plan.md`, chains in `project-notes.md`. If an incident changes what a result means, state it in one line inside the affected entry.

7. Summarise in chat: bug count (new versus re-verified), pass / fail / not-verified totals, and which items need a developer versus a spec fix. To re-consolidate later, use `/e2e report`.
