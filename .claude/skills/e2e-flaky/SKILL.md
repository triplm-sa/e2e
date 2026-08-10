---
name: e2e-flaky
description: Triage failing or intermittent cases after a run — re-run them, classify the cause (locator, timing, data, feature), and either propose or apply fixes with bounded auto-healing. Triggered by /e2e flaky.
---

# e2e-flaky

Decide whether a failure is a **genuine feature defect** or a **flaky, spec or environment problem**, then stabilise the case.

Shared conventions: `../_shared/conventions.md`.

**Input:** `<slug>`, already run at least once so `reports/<slug>/report.json` exists.

**Mode:** `analyze` (default) reports and proposes fixes only; `fix` also edits the spec. A request to "just fix it" selects `fix`.

**Output:** the analysis section of `reports/<slug>/report.md`, **written in Vietnamese** (see the language policy in conventions).

## Steps

1. Read `reports/<slug>/report.json` and select the failing cases.

2. **Re-run those cases in isolation, several times:**
   `cd e2e && pnpm e2e:retry <slug> "<id>"`, or for repeat runs
   `cd e2e && E2E_OUTDIR=reports/<slug> pnpm e2e:browser cases/<slug>/browser/<slug>.spec.ts -g "<id>" --repeat-each=3`.
   Never re-run the full suite to check one fix.
   For API steps, re-run `pnpm e2e:run` on the task's `cases.yaml`.

3. **Classify each failure** using `../_shared/references/flaky-taxonomy.md`:
   - Passing sometimes and failing other times → **flaky**. Replace fixed sleeps with web-first assertions; make leftover data independent; treat iframe, login and selector issues as preconditions.
   - For any locator suspicion, check it directly with `pnpm e2e:probe <target> <route> "<selector>"` before editing the spec — it distinguishes *wrong* (`0 match`) from *ambiguous* (`>1 match`, the usual cause of a locator that works sometimes), which guessing from a stack trace cannot.
   - Failing consistently on a business assertion → a **genuine feature defect**. Cite `file:line` and the relevant AC.

4. **In `fix` mode**, present the proposed fix list and **wait for the tester to confirm it**. After confirmation, apply the fixes and re-verify autonomously: **auto-heal for at most five rounds without asking again**, stopping only on a business-rule contradiction or when the five rounds are exhausted.

5. Treat a case as stable only when it **passes twice in a row**. Update the analysis section of `report.md` with the category and the recommended action, so the tester knows whether to fix the spec or raise a defect.
