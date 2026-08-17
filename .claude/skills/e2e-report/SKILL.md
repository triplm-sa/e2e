---
name: e2e-report
description: Consolidate the latest run and flaky classification into the final human-facing report. Triggered by /e2e report.
---

# e2e-report

**Role:** final consolidation for the tester. Do not rerun tests, repair specs or invent root causes.

**Load first:** `../_shared/core.md`.
**Load when needed:** `../_shared/references/flaky-taxonomy.md`.

**Input:** `<slug>` with `reports/<slug>/data/report.json` present. Run `/e2e run` first if absent.

**Output:** `reports/<slug>/report.html` — one self-contained page: engine-generated case table (with an embedded screenshot for every failed case that has one) plus the analysis you write. You never edit HTML by hand. You write plain Markdown into `reports/<slug>/data/analysis.md`, then run `pnpm e2e:report:build <slug>` to compile it — that command is the *only* thing that produces or touches `report.html`.

## Steps

1. Read `reports/<slug>/data/report.json` and the existing `reports/<slug>/data/analysis.md` when present. Treat `report.json` as execution truth. Coverage is not this skill's responsibility — see Boundary — so do not open `coverage.json` or restate coverage numbers here.
2. Write/update `data/analysis.md` in Markdown. Supported syntax: `##`/`###` headings, `> ` blockquotes, `- ` bullets, `**bold**`, `` `code` ``, `[text](url)` — anything else renders as plain text, so don't reach for richer markdown.
3. Fill the bug section with one block per **new bug** and **previously reported bug re-verified in this run**. Each block contains:
   - Hiện tượng — observed value/text;
   - Kỳ vọng — expected behaviour and AC;
   - Tái hiện — numbered manual reproduction steps;
   - Bằng chứng — the case ID is enough; its screenshot (if any) is embedded automatically next to that row in the generated table, do not paste image paths into the analysis;
   - Nghi ngờ nguyên nhân — `file:line` only when evidence supports it;
   - Trạng thái — new / fixed and verified / still reproducing.
4. Do not report `[NEEDS-SELECTOR-REVIEW]`, flaky, `Stale expectation` (see `flaky-taxonomy.md`), or setup failures as feature bugs. Environment claims require direct verification evidence.
5. Run `pnpm e2e:report:build <slug>`. It reads `data/report.json` + `data/analysis.md` and writes `reports/<slug>/report.html` — the case table, skip list and console-errors section are generated mechanically from `report.json`; you never retype or hand-build them. Re-run the build any time `analysis.md` changes; never hand-edit `report.html`.
6. Fill the CSV `Type` classification in `reports/<slug>/report.csv` only when the engine leaves it blank and the team needs it; do not reformat other generated columns.
7. Summarise in chat: new vs re-verified bug count, pass/fail/not-verified totals, and developer-vs-spec actions.

## Boundary

Coverage belongs in `plan.md`, `coverage.md` and `coverage.json`; data preparation belongs in `data.md`; state chains belong in `project-notes.md`; execution evidence belongs in `e2e-run`; flaky diagnosis belongs in `e2e-flaky`. The final report consumes these artifacts but does not regenerate coverage or rerun tests.

**Do not add sections about your own process.** What you automated during this run, how many records you created through the API, incidents while re-running, spec bugs you fixed along the way, state pollution you cleaned up, or which cases remain un-automated — none of that belongs in `analysis.md`; it goes in the artifacts above. If a run-time incident changes what a result *means* (e.g. leftover state made a case fail), say it in one line inside the affected bug or case entry, not as its own section.

## Completion check

`data/analysis.md` reflects the latest run, every reported bug has an evidence-backed category, `pnpm e2e:report:build <slug>` has been run after the last edit so `report.html` is current, and every failed case with a captured screenshot shows it inline when the file is opened.
