---
name: e2e-flaky
description: Triage failing or intermittent cases after a run — re-run them, classify the cause (locator, timing, data, feature), and either propose or apply fixes with bounded auto-healing. Triggered by /e2e flaky.
---

# e2e-flaky

Decide whether a failure is a **genuine feature defect** or a **flaky, spec or environment problem**, then stabilise the case.

Shared conventions: `../_shared/conventions.md`.

**Input:** `<slug>`, already run at least once. `reports/<slug>/report.json` exists only when the task has browser steps (Playwright's reporters produce it); a task that is API-only never has it — use `reports/<slug>/report.csv`/`report.md` instead (see step 1).

**Mode:** `analyze` (default) reports and proposes fixes only; `fix` also edits the spec. A request to "just fix it" selects `fix`.

**Output:** the analysis section of `reports/<slug>/report.md`, **written in Vietnamese** (see the language policy in conventions).

## Steps

1. Select the failing cases: for a task with browser steps, read `reports/<slug>/report.json`; for an API-only task (no `report.json`), read `reports/<slug>/report.csv`/`report.md` instead — same failing-case selection, no browser artefacts (no screenshots/console/traces) to inspect for those rows.

2. **Re-run those cases in isolation, several times:**
   `cd e2e && pnpm e2e:retry <slug> "<id>"`, or for repeat runs
   `cd e2e && E2E_OUTDIR=reports/<slug>/retry/repeat pnpm e2e:browser cases/<slug>/browser/<slug>.spec.ts -g "<id>" --repeat-each=3`.

   **Never point a `-g` or `--last-failed` run at `reports/<slug>` itself.** Playwright's html and json
   reporters replace their output folder with exactly what that invocation ran, so aiming a single-case
   run at the task folder erases every other case from `html/index.html` — they read as gone while
   still being green. `pnpm e2e:retry` already writes to `reports/<slug>/retry/<n>/` and merges results
   into the canonical `report.json`; a hand-rolled `e2e:browser` bypasses that, so give it an output
   directory under `retry/` as above.
   Never re-run the full suite to check one fix.
   For API steps, re-run `pnpm e2e:run` on the task's `cases.yaml`.

3. **Classify each failure** using `../_shared/references/flaky-taxonomy.md`:
   - Passing sometimes and failing other times → **flaky**. Replace fixed sleeps with web-first assertions; make leftover data independent; treat iframe, login and selector issues as preconditions.
   - For any locator suspicion, check it directly with `pnpm e2e:probe <target> <route> "<selector>"` before editing the spec — it distinguishes *wrong* (`0 match`) from *ambiguous* (`>1 match`, the usual cause of a locator that works sometimes), which guessing from a stack trace cannot.
   - Failing consistently on a business assertion → a **genuine feature defect**. Cite `file:line` and the relevant AC.

4. **In `fix` mode**, present the proposed fix list and **wait for the tester to confirm it**. After confirmation, apply the fixes and re-verify autonomously: **auto-heal for at most two rounds without asking again**, stopping on a business-rule contradiction or when the two rounds are exhausted.

   **Each round must run `pnpm e2e:retry <slug> "<case>"` for the case being fixed**, never the whole suite — a suite costs five to eight minutes, a single case costs seconds.

   The old limit was five rounds, which in practice meant no time limit at all: five rounds, each a run plus an analysis, consumes the entire time budget for the whole chain. After two rounds without the case going green, **stop and report to the tester**, listing what has been ruled out and what hypotheses remain. A cause that survives two rounds usually lies outside the spec, and rounds three through five are just guessing.

5. **Finish with one full run: `pnpm e2e:all <slug>`.** A retry writes to `reports/<slug>/retry/<n>/` and merges its result into `reports/<slug>/report.json`, but `html/index.html` can only be produced by an actual run, so after retries it still shows the last full run and omits every fix made since. Handing the tester that HTML means handing them a page that contradicts the numbers beside it. The full run also clears the retry folders.

6. Treat a case as stable only when it **passes twice in a row**. Update the analysis section of `report.md` with the category and the recommended action, so the tester knows whether to fix the spec or raise a defect.
