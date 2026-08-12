---
name: e2e-report
description: Consolidate the latest run, coverage validation and flaky classification into the final human-facing report. Triggered by /e2e report.
---

# e2e-report

**Role:** final consolidation for the tester. Do not rerun tests, repair specs or invent root causes.

**Load first:** `../_shared/core.md`.
**Load when needed:** `../_shared/references/flaky-taxonomy.md`.

**Input:** `<slug>` with `reports/<slug>/report.json` present. Run `/e2e run` first if absent.
**Output:** final `report.md` and engine-generated `report.csv`, with tester-facing analysis in Vietnamese.

## Steps

1. Read `report.json`, `coverage.json` and the existing `report.md` when present. Treat `report.json` as execution truth and `coverage.json` as coverage truth.
2. Summarise coverage before bug judgement: ACs mapped, required dimensions mapped, decision branches mapped, explicit exclusions, and whether deterministic validation passed. Never claim "100% coverage" unless every required mapping is present and the validator passed.
3. Fill the bug section with one block per **new bug** and **previously reported bug re-verified in this run**. Each block contains:
   - Hiện tượng — observed value/text;
   - Kỳ vọng — expected behaviour and AC;
   - Tái hiện — numbered manual reproduction steps;
   - Bằng chứng — artifact/trace links;
   - Nghi ngờ nguyên nhân — `file:line` only when evidence supports it;
   - Trạng thái — new / fixed and verified / still reproducing.
4. Do not report `[NEEDS-SELECTOR-REVIEW]`, flaky, or setup failures as feature bugs. Environment claims require direct verification evidence.
5. Leave engine-generated result sections intact except for necessary classification updates. Add the HTML report link.
6. Fill the CSV `Type` classification only when the engine leaves it blank and the team needs it; do not reformat other generated columns.
7. Summarise in chat: execution profile (FAST/STANDARD/HEAVY), AC/dimension/branch coverage, new vs re-verified bugs, pass/fail/not-verified totals, and developer-vs-spec actions.

## Boundary

Coverage belongs in `plan.md`, `coverage.md` and `coverage.json`; data preparation belongs in `data.md`; state chains belong in `project-notes.md`; execution evidence belongs in `e2e-run`; flaky diagnosis belongs in `e2e-flaky`. The final report consumes these artifacts but does not regenerate coverage or rerun tests.

## Completion check

The latest result is consolidated, coverage validation status is reported accurately, every reported bug has an evidence-backed category, `report.csv` remains engine-compatible, and the HTML report link is present.
