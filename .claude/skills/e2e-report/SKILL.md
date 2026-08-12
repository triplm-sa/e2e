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
5. **Preserve engine-generated artifacts mechanically.** If `report.generated.md` already contains the generated result tables/sections, do not manually retype, summarise, or reconstruct them. Use a shell/file operation (for example `cp`, `cat`, or a project script) to carry generated content into `report.md`, then edit only the tester-authored semantic sections that actually need changes. Never replace a large generated table with a hand-written equivalent.
6. Leave engine-generated result sections intact except for necessary classification updates. Add the HTML report link.
7. Fill the CSV `Type` classification only when the engine leaves it blank and the team needs it; do not reformat other generated columns.
8. Summarise in chat: execution profile (FAST/STANDARD/HEAVY), AC/dimension/branch coverage, new vs re-verified bugs, pass/fail/not-verified totals, and developer-vs-spec actions.

## Artifact handling rules

- Treat machine-generated artifacts as source data, not prose to reproduce.
- Prefer machine-to-machine transfer: copy/transform files with shell or project tooling instead of sending large generated content through the model and writing it back verbatim.
- When a generated section is correct, do not touch it merely to make the report "cleaner".
- If a generated section needs a semantic correction, make the smallest possible edit around the affected classification rather than rewriting the whole section.

## Boundary

Coverage belongs in `plan.md`, `coverage.md` and `coverage.json`; data preparation belongs in `data.md`; state chains belong in `project-notes.md`; execution evidence belongs in `e2e-run`; flaky diagnosis belongs in `e2e-flaky`. The final report consumes these artifacts but does not regenerate coverage or rerun tests.

## Completion check

The latest result is consolidated, coverage validation status is reported accurately, every reported bug has an evidence-backed category, `report.csv` remains engine-compatible, and the HTML report link is present.
