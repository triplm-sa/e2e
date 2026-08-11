---
name: e2e-analyze
description: Analyse a requirement before any test is generated — extract numbered acceptance criteria, map them to real code, surface ambiguities and get them confirmed, then write analysis.md. Triggered by /e2e analyze.
---

# e2e-analyze

Analyse the requirement to catch ambiguity **early**, before it turns into wrong test cases. This skill does **not** generate test cases.

Shared conventions: `../_shared/conventions.md`.

**Input:** `--jira <KEY>`, or a feature description, or files listed under `requirements.docs`. Ask the tester if none is available.

**Output:** `cases/<slug>/analysis.md`, **written in Vietnamese** (see the language policy in conventions).

## Steps

1. **Collect the requirement.** Read the `requirements` block in `e2e.config.yaml`. With `tracker: jira`, call `mcp__claude_ai_Atlassian_Rovo__getJiraIssue` (load the schema first via `ToolSearch("select:mcp__claude_ai_Atlassian_Rovo__getJiraIssue")` if it is deferred) and take the summary, description, acceptance criteria, comments and sub-tasks. With `tracker: none`, read `requirements.docs`.

2. **Extract acceptance criteria — the primary, mandatory output.** Produce a numbered list `AC-1`, `AC-2`, … Each AC must be a **concrete, verifiable statement** with an unambiguous pass or fail; reject vague phrasing such as "works correctly". Sources: the ticket's acceptance-criteria section, its description, any scenario tables, and QA comments. When the ticket is not explicit, derive the criteria from the requirement plus the source code. Two rules bound the list:

   **(a) An AC is one behaviour observable at the system boundary** — something the tester can see through the UI, through an API response, or in the data state afterwards. **Not a code branch.** Read the code to *discover* behaviour and to spot gaps between documentation and implementation, but an `if` branch becomes its own AC only when it produces an **outcome the tester can tell apart**. When three branches all end in "no rate is returned", that is **one** AC with three conditions, not three ACs.

   This is the single most important correction to this skill. The previous wording asked for "every branch, enum value and state worth checking" to become its own AC; `worth checking` is an unbounded judgement, and it produced almost a hundred ACs on one large feature. Worse, the same ticket analysed twice produced case counts 65% apart — a step that yields two different answers for the same input is **non-deterministic**, not merely broad.

   **(b) Tag every AC with its risk here**, rather than leaving `e2e-gen` to assign it later: **High** = money, permissions, data loss · **Medium** = core business logic · **Low** = secondary or cosmetic display. The risk travels with the AC through the whole chain and is what `e2e-gen` uses to allocate cases, so an AC without a risk is an unfinished AC.

   Sizing guidance, not a hard limit: a large feature ticket should yield roughly **25–40 ACs**. Far beyond that almost always means code branches are being counted as behaviours — go back to rule (a) and merge. Treat the number as a signal to re-check, never as an instruction to cut: a genuinely complex ticket may exceed it, provided each AC is a distinguishable behaviour.

3. **Establish traceability.** Map each AC to the real code, endpoint or selector that implements it. Read the `feature/<KEY>` branch diff for every repository in `requirements.diffRepos` (paths resolve relative to `e2e/`). A repository without that branch is untouched by the feature — skip it.

   **Issue every `git diff` in one parallel batch** — one `Bash` call per repository, all in the same message — rather than finishing one repository before starting the next. The repositories are independent, so there is no reason to serialise them, and a feature spanning several repositories pays that cost once per repository.

4. **Map how to reach every required state — do this before anyone judges what is automatable.** List what the tests need: entities (orders, members, accounts), **settings or modes to switch** (account type, feature toggles, payment terms) and **identities** to act as.

   Start from `../_shared/project-notes.md`, which records what earlier tasks discovered about this app. **It is often empty — that is normal, not an error.** For anything it does not cover, find the path yourself: grep the routers and controllers for mutating endpoints (`POST`, `PUT`, `PATCH`, `DELETE`), read any OpenAPI or GraphQL schema, and look at the endpoint the app's own UI calls. **Follow each chain to the end** — a create endpoint that only yields a draft is not the answer if a complete/approve/activate endpoint exists.

   Record a table: required state → chain of endpoints → cleanup → rung on `../_shared/references/automation-ladder.md`. **Append newly discovered chains to `project-notes.md`** so the next task starts from a richer map. This table is what stops `e2e-gen` from writing off cases as "needs manual preparation" when the system could reach the state itself.

5. **Hunt for ambiguity and contradictions.** Look for missing bounds, undefined error or timeout behaviour, unstated alternate flows, and unclear business rules. List them as `Q1`, `Q2`, …

6. **Confirm with the tester** via `AskUserQuestion` (at most four questions per round) for anything that changes the tests. Where a point cannot be settled, record it explicitly as a stated assumption.

7. **Write `analysis.md` as exactly four tables, no prose.** One table per section, with nothing between them but a heading line. The tables are written in Vietnamese like every other artifact — it is the surrounding explanation that is dropped, not the language:

   1. `| AC | Hành vi quan sát được | Risk |` — the AC list from step 2, risk already attached.
   2. `| AC | File:line / endpoint / selector |` — the traceability from step 3. Add a `Lệch` row for each point where the code differs from the documentation.
   3. `| Trạng thái cần | Chuỗi endpoint | Cleanup | Rung của ladder |` — the table from step 4.
   4. `| # | Điểm mơ hồ | Trả lời của tester, hoặc assumption đã ghi |` — from steps 5 and 6.

   An `analysis.md` on a recent large feature ran to well over two hundred lines, most of it prose restating what the tables already said. Prose here is pure output token cost, and output tokens are the slowest part of the chain. These four tables carry everything `e2e-gen` needs to read.

Finish by suggesting `/e2e gen --jira <KEY>`, which will read `analysis.md`.
