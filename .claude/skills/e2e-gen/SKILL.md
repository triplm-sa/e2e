---
name: e2e-gen
description: Generate the human-readable test plan (plan.md with AC and risk columns) plus a coverage matrix for the tester to approve, then compile the approved plan into cases.yaml and a Playwright spec. Triggered by /e2e gen.
---

# e2e-gen

Generate the tests for one feature in **two layers**: a human layer (`plan.md`, `coverage.md`) that the tester approves, then a machine layer (`cases.yaml`, spec) compiled **only after approval**. The tester never has to read YAML.

Shared conventions: `../_shared/conventions.md`.

**Input:** `--jira <KEY>` or a feature name, optionally `--design <file.html>`. When `cases/<slug>/analysis.md` exists (from `e2e-analyze`) use it as the backbone; when `recon.md` or `data.md` exist, use their verified selectors and real data.

**Output:** `cases/<slug>/plan.md` and `cases/<slug>/coverage.md` — **written in Vietnamese**; then `cases.yaml` and `browser/<slug>.spec.ts` as code (see the language policy in conventions).

## 1. Requirement

- `requirements.tracker: jira` → fetch from Jira over MCP. With `--jira`, prepend `jiraProjectKey` if the prefix is missing; with no key, ask the tester or search via `searchJiraIssuesUsingJql`. Take the summary, description, acceptance criteria, sub-tasks and links.
- `tracker: none` → read `requirements.docs`.
- When `analysis.md` exists, build on it instead of analysing from scratch.

## 2. Implementation context

Read the `feature/<KEY>` branch diff for every repository in `requirements.diffRepos` (paths resolve relative to `e2e/`): if the repository is on the feature branch use `git -C <repo> diff <baseBranch>...HEAD`, otherwise `git -C <repo> diff <baseBranch>...origin/feature/<KEY>`. A repository without that branch is untouched — skip it. Read the feature's source to learn the real endpoints and selectors. With `--design`, extract the expected elements, text and layout. For a new app with no feature branch, skip the diff and generate from the requirement alone.

## 3. Build coverage — by tracing, not from memory

- **Numbered ACs are the baseline.** Take `AC-1`, `AC-2`, … from `analysis.md`, or extract them the same way `e2e-analyze` does. With no AC list there is nothing to check coverage against, so **create it before generating any case**.
- **Choose targets.** Read every target in the config and decide which ones the feature touches: backend logic → `api`; admin actions → `cms`; customer-facing UI → `storefront`; app proxy routes → `proxy`. Never drop a target silently — record the reason in the plan.
- **Enumerate dimensions from data**, not intuition: each AC; **enum and config values found in the source** (grep union types and config arrays, list the **actual values**, at least one case per value); **pages and runtime states**, including where the feature must *not* apply, which becomes a **negative** case; boundaries and error paths. For large combinations use **pairwise** and record which combinations were dropped and why.
- **Apply the standard checklists in `../_shared/references/`:** forms and input fields → `field-validation.md`; `api` targets → `api-security.md`; genuine non-functional risk → `non-functional.md`.
- **Write `coverage.md` — a matrix, not prose:**
  - AC-to-case table: `| AC | Description | Covering cases |`. **Every AC needs at least one case**; an empty row is a gap.
  - Dimension-to-case table: each enum value, each page including negatives, each state (guest/logged-in, on/off, valid/invalid), each input field (1 positive + 2 negative). **An empty cell must either be filled or carry a documented reason.**
- Tag every case with a **risk rating** — High (money, permissions, data loss), Medium (core business logic), Low (secondary or cosmetic).

## 4. Write the plan

`plan.md` is what the tester approves, so keep it in plain business language: translate every technical term, and include no selectors, HTTP methods or paths. Structure it as:

- A coverage checklist grouped by scenario.
- The case table: `| # | AC | Risk | Scenario | Action | Expected result | Automatable? |` — a short id such as `TD-01`, the AC it covers, and the risk rating.

**Filling the "Automatable?" column is a decision, not an impression.** Apply `../_shared/references/automation-ladder.md` to every case whose precondition is not already satisfied. The precondition may be an entity, a **setting or mode to switch**, or an **identity to log in as** — all three are automatable.

- Reachable via an API, the app's or another service's → **automatable**; plan `phase: setup` steps to reach the state and `phase: teardown` steps to undo it.
- Reachable only through the UI → **automatable** via setup inside the spec; note that it is slower.
- **Follow the chain to the end.** Finding the first endpoint is not the answer. If `create-…` yields only a draft and a `complete-…` endpoint exists, the chain continues; stopping at the draft and skipping the case is a defect.
- Only when every rung fails may a case be manual, and the cell must carry the **per-rung justification** required by the ladder, naming the routers inspected.

Use the state-reachability table from `analysis.md` (step 4 of `e2e-analyze`) as input, together with any chains recorded in `../_shared/project-notes.md`. **Both may be empty** — then build the table now by listing the mutating endpoints yourself, and append what you learn to `project-notes.md`. An empty knowledge file is never a reason to mark a case manual.

**Gate before step 6:** for every case not marked automatable, confirm the cell contains a per-rung verdict with named endpoints or routers. A bare "needs a company with orders", "needs the account type changed" or "needs real data" is not a valid entry — resolve it into setup steps or write the full justification. Do not present a plan that still contains one.

## 5. Completeness critic — loop until dry

After the table and `coverage.md` exist, run section A of `../_shared/references/quality-gate.md`, then **iterate**:

1. Ask what is still missing, checking every AC, every enum value, every page including negatives, every input field, and the relevant non-functional and security dimensions.
2. Add the missing cases, update `coverage.md`, and repeat.
3. Stop when **two consecutive passes produce no new cases**.

**Hard gate before step 6:** `coverage.md` has no unexplained empty cells and **every AC is covered by at least one case**. Until then, do not present the plan. For higher assurance, have an independent subagent review the plan specifically for missing cases — a second perspective catches what the first pass rationalised away.

## 6. Present for approval

Show only the human-readable table — never the YAML — together with a **coverage summary line** so the tester sees any gap before approving: covered ACs out of total, enum values covered, number of negative cases, and any deliberately skipped cells.

**Always** offer the choice through `AskUserQuestion`: approve and compile / approve in part (for example API cases only) / request changes. Add a question for each open business decision. **Without approval, do not compile.**

## 7. Compile the approved plan

- **API case** → a step in `cases.yaml` with `case: <id>`, `request`, and `expect{status, bodyMatch}`. Steps run **sequentially**, so a business flow can be chained: `capture: { var: <body.path> }` stores a value from the response and later steps interpolate `${var}` into path, headers or body. A string equal to exactly `"${var}"` keeps its type; interpolation inside a longer string yields text. **Any YAML value containing `${...}` must be quoted.** A capture path missing from the response fails the step.

- **Carry the risk rating across.** Every `test` step gets `risk: High | Medium | Low`, copied from the plan, so the report and the generated `report.csv` can show it without anyone re-deriving it.

- **Mark independent API test-steps for concurrent execution.** API steps run sequentially by default because a later step may read a `${var}` an earlier one captured. After the chain is written, scan the `test`-phase steps for ones that share **no** capture dependency with their neighbours (neither reads a var another one in the group captures, nor captures a var name another one in the group also captures) and give them the same `parallelGroup: <name>` string — the runner batches and runs those concurrently. Only group steps that are adjacent in the file; do not scatter one group across unrelated steps. Never put a `setup` or `teardown` step in a group (the runner ignores it there anyway, to keep abort-on-setup-failure unambiguous). This is a mechanical, low-risk optimisation — apply it on every task, not only when speed is asked for, since it changes nothing about what gets asserted.

- **Precondition and cleanup steps** → same shape, plus `phase: setup` or `phase: teardown`. Setup steps run first and create the data the tests need; if one fails the remaining tests are reported as **SKIPPED rather than FAILED**, because they never received valid preconditions. Only `test` steps count towards the score. Teardown always runs, including after an abort, so anything setup created gets removed. Records that cannot be deleted (orders, for example) should be seeded once and asserted read-only instead of recreated every run — state that choice in the plan.
- **Browser case** → a step in `cases.yaml` (`case: <id>`, `action`, `spec`) plus the spec in `browser/<slug>.spec.ts`: import the fixture from `../../../src/browser-fixture.js` and start each test title with the case id, e.g. `test("TD-01 · …")`. Follow the template, the reliability rules and the embedded-app iframe guidance in `../_shared/conventions.md`. Before treating the spec as finished, run the definition of done in `quality-gate.md` section B.

- **Group the tests for parallel execution.** A browser suite is the slowest part of a task, and most of it is usually independent. Split the spec into `test.describe` blocks with an explicit `test.describe.configure({ mode: "parallel" | "serial" })`, following the parallel-safety rules in `../_shared/conventions.md`: read-only cases and cases that only touch their own namespaced data go in a parallel group; cases writing a shop-wide setting, clearing a shared collection, or asserting a store-wide total go in a serial group. Name created fixtures with the worker index and clean up only what matches that name, so a namespaced group can be parallelised too.

- **Never write an unverified selector.** Every selector must come from `recon.md` or be checked with `pnpm e2e:probe <target> <route> "<selector>" …` — one page load, a few seconds, and it reports `0 match` (guessed wrong) and `>1 match` (ambiguous, will be flaky) before any test runs. Probe the selectors for a case in **one batch**, then write them in. Discovering a bad selector by running the spec costs a full browser test and a rewrite; probing costs seconds, and a spec whose selectors were never verified will burn far more time in the repair loop than the probing would have taken.

Keep **case ids identical** across plan, coverage, yaml and spec.

**Hard gate before declaring step 7 done:** `pnpm e2e:verify <slug>`. It diffs every automatable case id in `plan.md` against `cases.yaml`, and for browser-kind steps, checks the referenced spec file actually contains a matching `test(...)`. This exists because "compile a step *and* a spec test" is easy to half-do without noticing — writing the spec test but forgetting the `cases.yaml` step (or vice versa) leaves no visible trace otherwise. A non-zero exit means real gaps; do not report the plan as compiled while it fails.
