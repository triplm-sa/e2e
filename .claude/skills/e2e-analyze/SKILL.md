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

4. **Hunt for ambiguity and contradictions.** Look for missing bounds, undefined error or timeout behaviour, unstated alternate flows, and unclear business rules. List them as `Q1`, `Q2`, …

5. **Confirm with the tester** via `AskUserQuestion` (at most four questions per round) for anything that changes the tests. Where a point cannot be settled, record it explicitly as a stated assumption.

6. **Write `analysis.md`** containing: the numbered AC list, the AC-to-code traceability, the questions with their answers or assumptions, and a preliminary risk rating (High / Medium / Low) per area.

Finish by suggesting `/e2e gen --jira <KEY>`, which will read `analysis.md`.
