---
name: e2e-gen
description: Generate an approval-ready test plan and coverage matrix, then compile the approved scope into cases.yaml and a Playwright spec. Triggered by /e2e gen.
---

# e2e-gen

**Role:** turn the analysed requirement into complete, reviewable coverage, then compile only the approved scope. Do not bypass approval.

**Load first:** `../_shared/core.md`.
**Load when needed:**
- `../_shared/references/quality-gate.md`
- `../_shared/references/automation-ladder.md`
- `../_shared/references/field-validation.md` for forms/inputs
- `../_shared/references/api-security.md` for API targets
- `../_shared/references/non-functional.md` for genuine non-functional risk
- `../_shared/project-notes.md`

**Input:** `--jira <KEY>` or feature name, optionally `--design <file.html>`. Prefer `analysis.md` and `recon.md` when present.

**Output:** first `plan.md` + `coverage.md` (Vietnamese); after approval, `cases.yaml` + `browser/<slug>.spec.ts`.

## Workflow

### 1. Establish the baseline

- Read the configured requirement source.
- If `analysis.md` exists, use its numbered AC list as the single baseline. Otherwise create the AC list before generating cases.
- Read relevant feature diffs and source implementation. Skip a repository only when its feature branch is absent.
- Choose touched targets from `e2e.config.yaml`; record why an apparently relevant target is not included.

### 2. Build coverage

For every AC, enumerate only evidence-backed dimensions:
- actual enum/config values from source;
- relevant pages and runtime states, including negative applicability;
- boundaries and error paths;
- security/non-functional dimensions when relevant.

Use pairwise for genuinely large combinations and document deliberate exclusions.

Create `coverage.md` with:

`| AC | Description | Covering cases |`

and a dimension matrix. Every AC and every required dimension must have a covering case or an explicit documented reason.

### 3. Decide automation

For every case whose precondition is not already satisfied, apply `automation-ladder.md`.

- Prefer an existing state.
- Then the app/another service API.
- Then UI setup.
- Only after all rungs fail may the case be manual.

Follow a state chain to its terminal business state. Do not stop at a draft when a complete/approve/activate endpoint exists. Use `analysis.md` reachability plus `project-notes.md`; an empty knowledge file is a discovery task, never a reason to mark manual.

For a manual case, record the per-rung verdict with the routers/endpoints inspected. A vague "needs real data" is invalid.

### 4. Write the human plan

`plan.md` must stay business-readable and contain no selectors, HTTP methods or paths.

Use:

`| # | AC | Risk | Scenario | Action | Expected result | Automatable? |`

Risk: High = money/permissions/data loss; Medium = core business logic; Low = secondary/cosmetic.

### 5. Completeness loop

Run the completeness section of `quality-gate.md`, then repeat:

1. inspect every AC, enum, page/state, input and relevant security/non-functional dimension;
2. add missing cases;
3. update `coverage.md`;
4. repeat until **two consecutive passes add no cases**.

**Hard gate:** do not present the plan while an AC is uncovered or a coverage cell is unexplained.

An independent subagent review is recommended for high-risk or large plans, but it must not replace the explicit completeness loop.

### 6. Approval gate

Present only the human-readable plan plus a compact coverage summary. Never show YAML as the approval artifact.

Use `AskUserQuestion` with:
- approve and compile;
- approve only selected scope;
- request changes.

If an open business decision remains, ask it here. **Without approval, do not compile.**

### 7. Compile approved scope

For API cases, compile sequential `cases.yaml` steps with `case`, `request`, `expect`, captures and quoted `${...}` values as required by the runner.

For setup/teardown, use `phase: setup|teardown`. A failed setup causes dependent tests to be reported as SKIPPED, not FAILED. Only `test` steps count toward pass/fail totals.

Carry the plan risk rating onto every test step.

For browser cases:
- create `browser/<slug>.spec.ts` using the project fixture;
- start titles with the case ID;
- use only selectors from `recon.md` or selectors verified by `pnpm e2e:probe`;
- use explicit parallel/serial groups based on shared-state rules in `core.md`;
- run the relevant definition-of-done checks from `quality-gate.md`.

## Completion check

Before compiling, verify:
- approval exists for the exact scope being compiled;
- every compiled case has a plan row and coverage mapping;
- every browser selector is verified;
- setup/teardown is defined for mutable state;
- case IDs and risk ratings are consistent across plan → coverage → yaml/spec.
