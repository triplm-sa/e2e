---
name: e2e-gen
description: Generate an approval-ready test plan, decision/coverage matrix, then compile the approved scope. Triggered by /e2e gen.
---

# e2e-gen

**Role:** turn the analysed requirement into complete, reviewable coverage, validate it deterministically, then compile only the approved scope. Do not bypass approval.

**Load first:** `../_shared/core.md`.
**Load when needed:**
- `../_shared/references/quality-gate.md`
- `../_shared/references/automation-ladder.md`
- `../_shared/references/test-oracle.md` when a case asserts a computed value (required before writing any High-risk calculated-value case)
- `../_shared/references/field-validation.md` for forms/inputs
- `../_shared/references/api-security.md` for API targets
- `../_shared/references/non-functional.md` for genuine non-functional risk
- `../_shared/project-notes.md`

**Input:** `--jira <KEY>` or feature name, optionally `--design <file.html>`. Prefer `analysis.md` and `recon.md` when present.

**Outputs:**
- before approval: `plan.md`, `coverage.md`, `coverage.json`;
- after approval: `cases.yaml` + `browser/<slug>.spec.ts`.

## Execution profiles

Choose the lightest profile that preserves coverage quality:

- **FAST:** small feature, <=10 planned cases, no meaningful combinatorial matrix, no high-risk branch. Skip independent review and non-applicable recon/reference work.
- **STANDARD:** default. Run the completeness loop and deterministic coverage validator.
- **HEAVY:** high-risk or large feature, >10 planned cases, multiple interacting decisions, security-sensitive behavior, or broad state matrix. Add an independent review before approval and use explicit decision/branch coverage.

Profile selection changes review depth, **not** the requirement that every AC and required coverage dimension is mapped.

## Workflow

### 1. Establish the baseline

- Read the configured requirement source.
- If `analysis.md` exists, use its numbered AC list as the single baseline. Otherwise create the AC list before generating cases.
- **If `analysis.md` is absent and any AC describes a computed/aggregate value, you must also produce its formula ledger** — the same table, under the same rules, as `e2e-analyze` step 3 (formula verbatim from code, `file:line`, cross-checked against the ticket, `[GAP-BRS]` where the ticket is silent). Write it to `analysis.md`. The AC list and the formula ledger are both outputs of the analysis step: taking on the first when `analyze` didn't run means taking on the second too. If you cannot trace a formula to real code, stop and tell the tester to run `/e2e analyze` — do not proceed to compile a computed expectation with no traced source.
- Read relevant feature diffs and source implementation. Skip a repository only when its feature branch is absent.
- Choose touched targets from `e2e.config.yaml`; record why an apparently relevant target is not included.

### 2. Build coverage and decision matrix

For every AC, enumerate only evidence-backed dimensions:
- actual enum/config values from source;
- relevant pages and runtime states, including negative applicability;
- boundaries and error paths;
- security/non-functional dimensions when relevant.

For each business decision in source or requirements, create a decision entry with **at least two branches** and map one or more cases to every branch. Examples: authorized/unauthorized, valid/invalid, sufficient/insufficient stock, active/inactive, B2B/retail.

Use pairwise for genuinely large combinations and document deliberate exclusions. Do not silently collapse distinct business decisions into one happy-path case.

Create:
- `coverage.md` for human review;
- `coverage.json` as the machine-readable source for deterministic validation, containing `acs`, `dimensions`, `decisions`, and `cases` with explicit mappings.

Every AC, required dimension and decision branch must have a covering case or an explicit documented reason for exclusion.

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

**`Expected result` states the rule, not a frozen number.** Write `Remaining = Limit − Used (AC-<n>)`, not `Remaining hiển thị $1,234.56`. The tester at the approval gate can judge a rule against the ticket; they cannot judge a bare literal without recomputing it themselves — and a literal lifted from `recon.md` would get their approval stamped onto an unverified number, which is the exact failure this pipeline guards against. A literal is fine only when the case's own setup creates the value (`seed 150 + 150 → tổng 300`). Concrete run-time numbers are settled later: `e2e-gen` step 7 cites the formula, `e2e-data` finalises the value.

### 5. Completeness loop + deterministic validator

Run the completeness section of `quality-gate.md`, then repeat:

1. inspect every AC, enum, page/state, input and relevant security/non-functional dimension;
2. inspect every decision and branch;
3. add missing cases;
4. update `coverage.md` and `coverage.json`;
5. repeat until **two consecutive passes add no cases**.

Then run:

`pnpm e2e:coverage:validate cases/<slug>/coverage.json`

The validator is **deterministic code**, not an LLM. It checks unique IDs, every AC mapping, required dimensions, decision branches, referenced case IDs and malformed coverage data. A failed validator is a hard gate.

For STANDARD/HEAVY profiles, after the validator passes, perform one independent review when required by the profile. The independent review can add cases, so rerun the validator after any change.

**Hard gate:** do not present the plan while an AC is uncovered, a required dimension/branch is unexplained, or the deterministic validator fails.

### 6. Approval gate

Present only the human-readable plan plus a compact coverage summary. Never show YAML as the approval artifact.

Use `AskUserQuestion` with:
- approve and compile;
- approve only selected scope;
- request changes.

If an open business decision remains, ask it here. **Without approval, do not compile.**

### 7. Compile approved scope

For API cases, compile sequential `cases.yaml` steps with `case`, `request`, `expect`, captures and quoted `${...}` values as required by the runner.

**A computed/aggregate expected value must never be copied from `recon.md`.** `quality-gate.md`'s "state real values" rule means every `expect` needs a concrete number now — it does not mean any concrete-looking number is safe to use. `recon.md`'s "Real data" is observation only (see `e2e-recon`); it exists to confirm selectors and supply raw setup facts, not to hand over expected results. Two cases:

- **Plain combination arithmetic** over facts this case's own setup created (sum/subtract/count of known values) — write it directly, no citation needed; it's not a business decision, just addition.
- **A formula that embeds a business decision** (rounding, a categorisation threshold, which records count) must cite `analysis.md`'s formula ledger (see `e2e-analyze`): `# derived per analysis.md AC-16 (ReportCreditCard.tsx:42): round(used/limit×100)`. The concrete number itself may still need `e2e-data`'s ownership/live-baseline decision (`test-oracle.md`) — cite the formula now, the number gets finalised there.

If `analysis.md` has no formula for a business-decision case yet (it should — go back and add it rather than substituting a recon observation), or you can't yet tell which of the two cases above applies, mark it explicitly:

```yaml
expect: { bodyMatch: { "totals.0.total": 598 } }  # [UNVERIFIED — no analysis.md formula trace; needs e2e-data's derived/anchor classification]
```

Do not tag simple existence/status/id checks (`status: 200`, an id you captured yourself, a label that's just present) — only values a bug in calculation logic could make wrong. `e2e-data` resolves every `[UNVERIFIED]` marker next; leaving one behind for it to silently accept as already-concrete is exactly the gap this tag exists to prevent. **Never write a computed value straight from `recon.md` without either citation** — that's the exact failure mode this rule exists to block.

For setup/teardown, use `phase: setup|teardown`. A failed setup causes dependent tests to be reported as SKIPPED, not FAILED. Only `test` steps count toward pass/fail totals.

Carry the plan risk rating onto every test step.

For browser cases:
- create `browser/<slug>.spec.ts` using the project fixture;
- start titles with the case ID;
- use only selectors from `recon.md` or selectors verified by `pnpm e2e:probe`;
- use explicit parallel/serial groups based on shared-state rules in `core.md`;
- run the relevant definition-of-done checks from `quality-gate.md`;
- the same rule applies to a computed/aggregate value asserted in the spec: cite `analysis.md`'s formula trace (`// derived per analysis.md AC-16: ...`), or tag it `// [UNVERIFIED — no analysis.md formula trace]` — not just for `cases.yaml`.

After compilation, validate the exact approved coverage against the compiled cases:

`pnpm e2e:coverage:validate cases/<slug>/coverage.json cases/<slug>/cases.yaml`

Do not run or report the compiled scope if this check fails.

## Completion check

Before compiling, verify:
- approval exists for the exact scope being compiled;
- every compiled case has a plan row and coverage mapping;
- every browser selector is verified;
- setup/teardown is defined for mutable state;
- case IDs and risk ratings are consistent across plan → coverage → yaml/spec;
- deterministic coverage validation passes.

After compiling: every literal expect value taken from an observation (not computed) is tagged `[UNVERIFIED]` — an untagged hard-coded number is only acceptable when it's a status code, a captured id, or a value the case's own setup created.
