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

2. **Extract acceptance criteria — the primary, mandatory output.** Produce a numbered list `AC-1`, `AC-2`, … Each AC must be a **concrete, verifiable statement** with an unambiguous pass or fail; reject vague phrasing such as "works correctly". Sources: the ticket's acceptance-criteria section, its description, any scenario tables, and QA comments. When the ticket is not explicit, **derive the criteria from the requirement plus the source code**, turning every branch, enum value and state worth checking into its own AC. This list is the baseline `e2e-gen` uses to prove coverage — without it, cases will certainly be missed.

3. **Establish traceability.** Map each AC to the real code, endpoint or selector that implements it. Read the `feature/<KEY>` branch diff for every repository in `requirements.diffRepos` (paths resolve relative to `e2e/`). A repository without that branch is untouched by the feature — skip it.

4. **Map how to reach every required state — do this before anyone judges what is automatable.** List what the tests need: entities (orders, members, accounts), **settings or modes to switch** (account type, feature toggles, payment terms) and **identities** to act as.

   Start from `../_shared/project-notes.md`, which records what earlier tasks discovered about this app. **It is often empty — that is normal, not an error.** For anything it does not cover, find the path yourself: grep the routers and controllers for mutating endpoints (`POST`, `PUT`, `PATCH`, `DELETE`), read any OpenAPI or GraphQL schema, and look at the endpoint the app's own UI calls. **Follow each chain to the end** — a create endpoint that only yields a draft is not the answer if a complete/approve/activate endpoint exists.

   Record a table: required state → chain of endpoints → cleanup → rung on `../_shared/references/automation-ladder.md`. **Append newly discovered chains to `project-notes.md`** so the next task starts from a richer map. This table is what stops `e2e-gen` from writing off cases as "needs manual preparation" when the system could reach the state itself.

5. **Hunt for ambiguity and contradictions.** Look for missing bounds, undefined error or timeout behaviour, unstated alternate flows, and unclear business rules. List them as `Q1`, `Q2`, …

6. **Confirm with the tester** via `AskUserQuestion` (at most four questions per round) for anything that changes the tests. Where a point cannot be settled, record it explicitly as a stated assumption.

7. **Write `analysis.md`** containing: the numbered AC list, the AC-to-code traceability, the **data-creation table from step 4**, the questions with their answers or assumptions, and a preliminary risk rating (High / Medium / Low) per area.

Finish by suggesting `/e2e gen --jira <KEY>`, which will read `analysis.md`.
