---
name: e2e-gen
description: Generate the human-readable test plan (plan.md with AC and risk columns) plus a coverage matrix for the tester to approve, then compile the approved plan into cases.yaml and a Playwright spec. Triggered by /e2e gen.
---

# e2e-gen

Generate the tests for one feature in **two layers**: a human layer (`plan.md`) that the tester approves, then a machine layer (`cases.yaml`, spec) compiled **only after approval**. The tester never has to read YAML.

Shared conventions: `../_shared/conventions.md`.

**Input:** `--jira <KEY>` or a feature name, optionally `--design <file.html>`. When `cases/<slug>/analysis.md` exists (from `e2e-analyze`) use it as the backbone; when `recon.md` exists, use its verified selectors and real data.

**Output:** `cases/<slug>/plan.md` — **written in Vietnamese**; then `cases.yaml` and `browser/<slug>.spec.ts` as code (see the language policy in conventions). There is no longer a separate coverage or data artifact: coverage lives in the summary line at the top of `plan.md`, and data lives in the `Dữ liệu` column of the case table.

## 1. Requirement

- `requirements.tracker: jira` → fetch from Jira over MCP. With `--jira`, prepend `jiraProjectKey` if the prefix is missing; with no key, ask the tester or search via `searchJiraIssuesUsingJql`. Take the summary, description, acceptance criteria, sub-tasks and links.
- `tracker: none` → read `requirements.docs`.
- When `analysis.md` exists, build on it instead of analysing from scratch.

## 2. Implementation context

Read the `feature/<KEY>` branch diff for every repository in `requirements.diffRepos` (paths resolve relative to `e2e/`): if the repository is on the feature branch use `git -C <repo> diff <baseBranch>...HEAD`, otherwise `git -C <repo> diff <baseBranch>...origin/feature/<KEY>`. A repository without that branch is untouched — skip it. Read the feature's source to learn the real endpoints and selectors. With `--design`, extract the expected elements, text and layout. For a new app with no feature branch, skip the diff and generate from the requirement alone.

## 3. Build coverage — by tracing, not from memory

- **Numbered ACs are the baseline.** Take `AC-1`, `AC-2`, … **together with their risk ratings** from `analysis.md`, or extract them the same way `e2e-analyze` does. With no AC list there is nothing to check coverage against, so **create it before generating any case**.

- **Allocate cases by risk:**
  - **High-risk AC** → **at least one case of its own**. Never folded. This is the part that is never cut.
  - **Medium-risk AC** → **one case covering several ACs**. A business flow passing through five Medium ACs is one case, not five; the case's `AC` column lists all five.
  - **Low-risk AC** → **one smoke case for the whole group**, asserting that the screen renders and the main labels are right.
  - **Target size: about 50 cases, of which about 25 are browser tests.** This is a **warning signal, not a hard limit**: exceeding it means "go back and look for duplicates", not "cut until the number fits". The figure is an estimate derived from one oversized run and should be recalibrated once real timings exist.

- **What to cut, and in what order.** The goal is to **remove duplicate and meaningless cases**, not to make the count look smaller. When trimming is needed, work in this order and stop as soon as the target size is reached:

  1. **Duplicates** — two cases with different names that exercise the same code path and assert the same outcome. Drop one, keep whichever uses more realistic data.
  2. **Variants that change no outcome** — the same behaviour re-checked with a different value while the handling branch stays the same. Once "wrong market → no rate returned" is covered, a second and third market add nothing.
  3. **Cases that essentially cannot occur** — combinations a real user cannot produce, or that are only reachable by calling the API by hand to bypass a UI the AC is actually about. Record the reason; never drop one silently.
  4. **Purely presentational cases** — labels, column order, empty-state wording. Fold the group into a single smoke case.
  5. **Field variants on Medium and Low ACs** — fold several fields into one case, following `../_shared/references/field-validation.md`.

  **Never cut, even when over the target size:**
  - a case for a **High-risk AC** — money, permissions, data loss;
  - the **last remaining negative** case for a behaviour (if only one case still proves "the system blocks the invalid path", it must live);
  - a case at a **boundary** of a calculation (a tier threshold, the gap between two tiers, a usage limit);
  - a case proving a **documentation-versus-implementation gap** found during `analyze` or `recon`.

  If all five steps have been applied and the plan is still over the target size, **stay over it** and add one line to `plan.md` explaining why this feature genuinely needs more cases than usual. Being over the target with a stated reason is a correct outcome; dropping a High-risk case to hit a number is a wrong one.

  These rules replace the old gate "every AC needs at least one case". That gate turned an inflated AC list into an inflated case list and was the largest of the four multipliers behind the slow chain — but it was wrong because it **multiplied uniformly**, not because it produced many cases. Whatever replaces it must still tell a case worth keeping from a redundant one, rather than merely counting.
- **Choose targets.** Read every target in the config and decide which ones the feature touches: backend logic → `api`; admin actions → `cms`; customer-facing UI → `storefront`; app proxy routes → `proxy`. Never drop a target silently — record the reason in the plan.
- **Enumerate dimensions from data**, not intuition: each AC; **enum and config values found in the source** (grep union types and config arrays, list the **actual values**); **pages and runtime states**, including where the feature must *not* apply, which becomes a **negative** case; boundaries and error paths.

  **Then fold before turning them into cases.** Every enum value must appear somewhere, but **several enum values can share one case** when they do not interact — split them only when it is their combination that carries the risk. Pages where the feature must not apply get one negative case for the whole group. For large combinations use **pairwise**, and record which combinations were dropped and why. Enumerating dimensions exists to **avoid missing something**, not to multiply.
- **Apply the standard checklists in `../_shared/references/`:** forms and input fields → `field-validation.md`; `api` targets → `api-security.md`; genuine non-functional risk → `non-functional.md`.
- **Do not write a coverage artifact.** It has been removed: most of it merely restated what the `AC` column of `plan.md` already carries. Replace it with **one coverage summary line at the top of `plan.md`**, in exactly this shape:

  `Độ phủ: <n>/<tổng> AC (High <a>/<a>, Medium <b>/<b>, Low <c>/<c>) · <k>/<tổng> giá trị enum · <m> case âm · gộp/bỏ: <short list with reasons>`

  The gate is: **every High-risk AC is covered**, and everything folded or dropped is named in the `gộp/bỏ` part. Know the trade-off being made: dropping the coverage artifact loses the dimension-to-case matrix, and the `AC` column does not fully replace it — this summary line is the compensation, so write it in full rather than abbreviating it.
- Tag every case with a **risk rating** — High (money, permissions, data loss), Medium (core business logic), Low (secondary or cosmetic).

## 4. Write the plan

`plan.md` is what the tester approves, so keep it in plain business language: translate every technical term, and include no selectors, HTTP methods or paths. Structure it as:

- A coverage checklist grouped by scenario.
- The case table: `| # | AC | Risk | Scenario | Action | Expected result | Dữ liệu | Automatable? |` — a short id such as `TD-01`, every AC the case covers (a Medium case covering several ACs lists all of them, so that a failure still points at which AC broke), and the risk rating.

  **The `Dữ liệu` column** replaces the separate data artifact. It holds **concrete, verified values** — ids, handles, emails, real amounts on the store — each with its source noted briefly in brackets: `(có sẵn)`, `(setup step)` or `(sinh mới)`. Never write "a valid email". Real values come from `recon.md`, since `e2e-recon` is now where the store is queried for them. For a case that must create a new value, use a `[prefix]_[case]_[timestamp]_[random]` shape so the value is both unique and traceable, and note how to revert it in the same column when the case mutates real data.

**Filling the "Automatable?" column is a decision, not an impression.** Apply `../_shared/references/automation-ladder.md` to every case whose precondition is not already satisfied. The precondition may be an entity, a **setting or mode to switch**, or an **identity to log in as** — all three are automatable.

- Reachable via an API, the app's or another service's → **automatable**; plan `phase: setup` steps to reach the state and `phase: teardown` steps to undo it.
- Reachable only through the UI → **automatable** via setup inside the spec; note that it is slower.
- **Follow the chain to the end.** Finding the first endpoint is not the answer. If `create-…` yields only a draft and a `complete-…` endpoint exists, the chain continues; stopping at the draft and skipping the case is a defect.
- Only when every rung fails may a case be manual, and the cell must carry the **per-rung justification** required by the ladder, naming the routers inspected.

Use the state-reachability table from `analysis.md` (step 4 of `e2e-analyze`) as input, together with any chains recorded in `../_shared/project-notes.md`. **Both may be empty** — then build the table now by listing the mutating endpoints yourself, and append what you learn to `project-notes.md`. An empty knowledge file is never a reason to mark a case manual.

**Gate before step 6:** for every case not marked automatable, confirm the cell contains a per-rung verdict with named endpoints or routers. A bare "needs a company with orders", "needs the account type changed" or "needs real data" is not a valid entry — resolve it into setup steps or write the full justification. Do not present a plan that still contains one.

## 5. Correctness pass — one round, both directions

Once the case table exists, run section A of `../_shared/references/quality-gate.md`, then make **one single pass** — no iteration. The goal is a case set that is **exact**: nothing missing, nothing redundant. Check both directions, because a pass that only looks for gaps can only ever add.

**Direction one — nothing missing.** Walk from the ACs down to the cases:
- every **High-risk AC** has a case of its own;
- every **enum value** appears in some case;
- every negative behaviour, every **boundary of a calculation**, and every documentation-versus-implementation gap found earlier has a case.

**Direction two — nothing redundant.** Walk from the cases back up to the ACs, asking three questions of each case:
1. Which AC does it trace to? A case that traces to none is redundant — remove it.
2. Does another case exercise the same code path and assert the same outcome? If so they are one case — merge them.
3. Could a real user produce this situation at all? If not, remove it and record the reason.

Then **stop**. Update the coverage summary line at the top of `plan.md` and move on.

The previous version looped until "two consecutive passes produce no new cases" — it stopped when **exhausted**, not when **correct**, and an exhaustion loop always finds something else to add. It also dispatched an independent subagent to hunt for missing cases; that is removed, since it cost an agent plus the wait and could only ever push in one direction.

**Gate before step 6:** every High-risk AC has a case, and everything folded or dropped is named in the coverage summary line. A Medium AC without a case of its own is **not** a gap — it is the intended result of the folding rules in §3. Anything still uncertain — plausibly redundant, plausibly needed — goes to the tester as an open question in step 6 rather than being silently resolved either way.

## 6. Present for approval

Show only the human-readable table — never the YAML — together with the **coverage summary line** from §3, in the shape defined there, so the tester sees any gap before approving: covered ACs out of total **broken down by risk**, enum values covered, number of negative cases, and everything folded or dropped with its reason. Since there is no coverage artifact any more, this line is the only thing the tester has to judge coverage by — write it in full.

Also present, as its own short list, the **cases you were unsure about** — plausibly redundant, plausibly needed. Whether a situation is realistic enough to be worth testing is a business judgement, so it belongs to the tester, not to this skill.

**Always** offer the choice through `AskUserQuestion`: approve and compile / approve in part (for example API cases only) / request changes. Add a question for each open business decision. **Without approval, do not compile.**

## 7. Compile the approved plan

- **API case** → a step in `cases.yaml` with `case: <id>`, `request`, and `expect{status, bodyMatch}`. Steps run **sequentially**, so a business flow can be chained: `capture: { var: <body.path> }` stores a value from the response and later steps interpolate `${var}` into path, headers or body. A string equal to exactly `"${var}"` keeps its type; interpolation inside a longer string yields text. **Any YAML value containing `${...}` must be quoted.** A capture path missing from the response fails the step.

- **Carry the risk rating across.** Every `test` step gets `risk: High | Medium | Low`, copied from the plan, so the report and the generated `report.csv` can show it without anyone re-deriving it.

- **Precondition and cleanup steps** → same shape, plus `phase: setup` or `phase: teardown`. Setup steps run first and create the data the tests need; if one fails the remaining tests are reported as **SKIPPED rather than FAILED**, because they never received valid preconditions. Only `test` steps count towards the score. Teardown always runs, including after an abort, so anything setup created gets removed. Records that cannot be deleted (orders, for example) should be seeded once and asserted read-only instead of recreated every run — state that choice in the plan.
- **Browser case** → a step in `cases.yaml` (`case: <id>`, `action`, `spec`) plus the spec in `browser/<slug>.spec.ts`: import the fixture from `../../../src/browser-fixture.js` and start each test title with the case id, e.g. `test("TD-01 · …")`. Follow the template, the reliability rules and the embedded-app iframe guidance in `../_shared/conventions.md`. Before treating the spec as finished, run the definition of done in `quality-gate.md` section B.

- **Group the tests for parallel execution — a condition that must not be violated, not a suggestion.** No `test()` may sit outside a `test.describe` carrying an explicit `test.describe.configure({ mode: "parallel" })` or `configure({ mode: "serial" })`. A spec that breaks this is an unfinished spec.

  Why this is a hard gate rather than advice: Playwright parallelises **at file level**, and a task has a single spec file, so `workers: 4` in `playwright.config.ts` is **entirely inert** unless the spec has describe groups. This has been measured — specs written with no describe group ran on one worker, taking 341s for 19 tests and 501s for 28 tests, while a spec split into four groups ran on four workers and took 318s for 68 tests. The previous version of this skill already gave this guidance, but phrased as a recommendation, and **two of three specs ignored it completely**.

  Group according to the parallel-safety rules in `../_shared/conventions.md`: read-only cases and cases touching only their own namespaced data go in a `parallel` group; cases writing a shop-wide setting, clearing a shared collection, or asserting a store-wide total go in a `serial` group. Name created fixtures with the worker index and clean up only what matches that name, so a namespaced group can be parallelised too.

- **Copy every selector from `recon.md` verbatim. This skill does not open a browser.** Selector verification happens once, in `e2e-recon` step 6, which probes them a route at a time and records a verdict per row. That single verification point is what keeps the chain fast: two stages both paying an embedded-app boot to check the same selectors is pure duplicated cost.

  Three consequences, all of which have been violated in a real run and cost a full suite:

  - **Never invent a selector that is not in the table.** No element in `recon.md` means the flow was never inspected — go back to `/e2e recon` for that route rather than guessing from source. Source code proves an element exists; it cannot prove the selector matches exactly one element on the rendered page, and uniqueness is the whole game.
  - **Never weaken a selector.** Rewriting a `getByLabel('…')` from the table as `getByText('…')` in the spec silently discards the verification: the probed locator and the written locator are no longer the same thing. This exact substitution has turned a verified single match into a five-element strict-mode violation. If a selector genuinely has to change, re-probe the new one and update `recon.md` — never change it only in the spec.
  - **Never write an interaction with a picker or multi-select until its commit mechanism is confirmed.** Before writing any step that chooses from a picker, modal or popover, there must be a confirmation from one of three sources — a `recon.md` row naming the confirm button, an entry under **UI interaction patterns** in `../_shared/project-notes.md`, or the component source read directly — saying whether the selection commits on click or needs an explicit button. Without one, **do not** write "click the item and carry on": stop and send that route back to `/e2e recon`.

    The `project-notes.md` entry is a shortcut, not a prerequisite: on a new app that section is **empty, which is normal**, and the other two sources still satisfy the gate. An empty table never means "no picker needs checking".

    This is not a hypothetical. A wizard step was once written as *click the option, then dismiss the overlay*, on the assumption that a list of options behaves like a self-closing combobox. It was in fact a modal holding the choice in local state until its confirm button was clicked, so every dismissal discarded the selection — and because the resulting failure landed on a business assertion further down the flow, it read as a product defect and survived several repair rounds. When writing the sequence, assert the confirm button is **enabled** before clicking it: these buttons are commonly disabled until something is selected, and clicking a disabled button burns the full action timeout while reporting only that the locator never became stable.

  - **Carry the `⚠️ chưa xác minh` marking through.** A row that could not be probed still becomes a case, but tag the case in `cases.yaml` with `unverifiedSelector: true` so `e2e-run` reports a failure there as not-yet-verified rather than as a feature defect. An unverified selector reported as a product bug wastes developer time and costs more trust than a slow run.

- **Write the spec groups in parallel — split by workload, not by group boundary.** Once the tester has approved the plan, the `describe` groups are by definition free of shared state, so they can be written concurrently: each writer receives its slice of the case table plus the verified selectors from `recon.md`, and returns finished `test.describe` blocks.

  **Balance the split by number of tests, not by number of groups.** Groups are rarely even — a real split came out 9 / 6 / 1 / 1, where dispatching a separate writer for a one-test group costs more in prompt-building than writing it inline, and the wall-clock is set by the 9-test group regardless. So: give the largest group its own writer, bundle the small ones together, and split a group that dwarfs the rest across two writers. One writer per group is a default, not a rule.

  **Then reconcile.** Several agents writing concurrently will produce duplicate helpers — this is a known cost of the approach, not a surprise. After the groups come back, do one short merge pass: hoist duplicate helpers to the top of the file, consolidate imports into a single block, and confirm no function is defined twice. Verify with `pnpm exec tsc --noEmit -p tsconfig.json` before treating the spec as finished.

Keep **case ids identical** across plan, yaml and spec.
