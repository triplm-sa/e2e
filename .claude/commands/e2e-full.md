---
description: Run the entire E2E lifecycle for one feature through to the final report — orchestrates analyze, recon, gen (with the approval gate), data, run, flaky and report.
argument-hint: "<feature> | --jira KEY [--design f.html]"
---

The user invoked `/e2e-full $ARGUMENTS`. This command is the **orchestrator**. Execute the lifecycle as a state machine and use one stage skill at a time.

> **Load and follow each skill with the Skill tool, in this order:**
> `e2e-analyze` → `e2e-recon` → `e2e-gen` → `e2e-data` → `e2e-run` → `e2e-flaky` → `e2e-report`.
>
> Load `.claude/skills/_shared/core.md` first. Each stage loads only the references it needs. Do not treat the shared references as one giant instruction set.

## Global execution rules

### MUST

- Stop to ask the tester only for the **plan approval gate** or a genuine **business-rule contradiction** that cannot be safely resolved from requirements, code, or existing project notes.
- Maintain `cases/<slug>/task.md` as the authoritative progress ledger.
- Never mark a stage complete until its required output artifact exists and passes that stage's completion checks.
- Keep case IDs identical across `plan.md`, `coverage.md`, `coverage.json`, `cases.yaml`, spec and reports.
- Write generated artifacts and tester-facing summaries in Vietnamese; code comments remain English as defined by the core convention.
- In orchestrated mode, `e2e-flaky` may auto-heal for at most five rounds without asking again.

### SHOULD

- Continue autonomously through non-blocking ambiguity by recording an explicit assumption.
- Prefer API/setup automation over UI setup when the business assertion is elsewhere.
- Reuse known state chains from `project-notes.md` and append genuinely new discoveries.
- Choose the lightest execution profile that preserves coverage quality: FAST for small/low-risk features, STANDARD by default, HEAVY for high-risk or combinatorial features.

## Execution profiles

- **FAST:** <=10 planned cases, no meaningful combinatorial matrix, no high-risk branch. Skip independent review and non-applicable recon/reference work. Still run deterministic coverage validation.
- **STANDARD:** default. Run completeness loop, decision/branch matrix when applicable, deterministic coverage validation and targeted flaky healing.
- **HEAVY:** high-risk or large feature, >10 planned cases, multiple interacting decisions, security-sensitive behavior, or broad state matrix. Add independent review and explicit branch coverage before approval. Use parallel execution only for isolated cases.

The profile controls depth and optional work; it never permits an uncovered AC or unexplained required dimension/branch.

## State machine

| State | Required input | Required output | Completion condition |
|---|---|---|---|
| `ANALYZED` | feature/Jira requirement | `analysis.md` | numbered ACs + traceability + state-reachability table |
| `RECONSTRUCTED` | `analysis.md` | `recon.md` | required UI selectors/data verified, unless API-only |
| `PLANNED` | `analysis.md` + `recon.md` when applicable | `plan.md`, `coverage.md`, `coverage.json` | every AC covered; required dimensions/branches explained; deterministic validator passes |
| `APPROVED` | human-readable plan | approval decision | tester approves full or partial scope |
| `DATA_READY` | approved plan | `data.md`, populated yaml/spec | every required value has a concrete source |
| `EXECUTED` | cases + spec | `report.json`, merged run report | API/browser layers completed or explicitly not applicable |
| `STABLE` | execution failures | updated failure analysis | flaky candidates pass twice consecutively, or five healing rounds exhausted |
| `REPORTED` | latest execution + classification | consolidated `report.md`, `report.csv` | final report and HTML link are available |

## Stage transitions

1. **Analyze** — load `e2e-analyze`. Create `analysis.md` and initialize/update `task.md`.
2. **Recon** — load `e2e-recon` unless the feature has no browser/UI target. Its input is `analysis.md`; it may also consume an existing `plan.md` or `cases.yaml` when running standalone. Create `recon.md`.
3. **Gen** — load `e2e-gen`. Select FAST/STANDARD/HEAVY profile, then create `plan.md`, `coverage.md` and `coverage.json`. Do not compile before approval.
4. **Approval** — pause and use `AskUserQuestion`. If partially approved, compile only the approved scope and record exclusions.
5. **Data** — load `e2e-data`. Create `data.md` and fill concrete values/setup steps.
6. **Run** — load `e2e-run`. Execute API and browser layers, merge raw results, and classify failures provisionally. `e2e-run` owns execution evidence, not final report consolidation.
7. **Flaky** — load `e2e-flaky` with **orchestrated mode**. Stabilise only failing/intermittent cases using targeted retries. Maximum five repair rounds. Do not rerun the full suite for an isolated failure.
8. **Post-healing verification** — only if a repair changed executable code/spec/fixture/shared setup, run one final full suite through `e2e-run`. If no repair was applied, do not rerun already-passing cases.
9. **Report** — load `e2e-report`. Consolidate the latest results and export the final human-facing report.

## Progress ledger

Create `cases/<slug>/task.md` with this shape and update it after each verified transition:

```md
# E2E Task Progress

- [ ] ANALYZED — analysis.md
- [ ] RECONSTRUCTED — recon.md / not applicable
- [ ] PLANNED — plan.md + coverage.md + coverage.json
- [ ] APPROVED — scope: pending
- [ ] DATA_READY — data.md + populated cases/spec
- [ ] EXECUTED — report.json
- [ ] STABLE — flaky stage complete
- [ ] REPORTED — report.md + report.csv
```

A checkbox may be marked complete only after the named artifact exists and the stage's completion condition is satisfied. If a stage fails, leave it unchecked and record the one-line reason.

## Input and exceptions

- Missing feature input: ask before starting. The run needs `--jira KEY` or a feature description.
- A browser target that is not touched by the feature: mark recon as `not applicable` with the reason; do not silently skip it.
- If a stage discovers a business-rule contradiction, stop and ask the tester. Do not guess.
- If the environment is unhealthy, verify it directly before claiming an environment failure.

## Finish

Mark every applicable stage complete in `task.md`. Give the tester a concise Vietnamese summary: pass/fail/not-verified totals, new versus re-verified bugs, risk distribution, items needing developer versus spec review, coverage profile, and the link to `reports/<slug>/html/index.html`.
