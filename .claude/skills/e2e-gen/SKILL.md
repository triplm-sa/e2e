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
- The case table: `| # | AC | Risk | Scenario | Action | Expected result | Automatable? |` — a short id such as `TD-01`, the AC it covers, the risk rating, and an honest automatable column: yes, "needs \<preparation\>", or not-yet-automated with the reason stated rather than hidden.

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
- **Browser case** → a step in `cases.yaml` (`case: <id>`, `action`, `spec`) plus the spec in `browser/<slug>.spec.ts`: import the fixture from `../../../src/browser-fixture.js` and start each test title with the case id, e.g. `test("TD-01 · …")`. Follow the template, the reliability rules and the embedded-app iframe guidance in `../_shared/conventions.md`. Before treating the spec as finished, run the definition of done in `quality-gate.md` section B.

Keep **case ids identical** across plan, coverage, yaml and spec.
