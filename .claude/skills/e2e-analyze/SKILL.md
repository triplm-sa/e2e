---
name: e2e-analyze
description: Analyse a requirement before test generation — extract numbered acceptance criteria, trace them to real code, map reachable states and surface only material business ambiguity. Triggered by /e2e analyze.
---

# e2e-analyze

**Role:** establish the factual baseline for every later stage. Do not generate test cases here.

**Load first:** `../_shared/core.md`.
**Load when needed:** `../_shared/references/automation-ladder.md`, `../_shared/project-notes.md`.

**Input:** `--jira <KEY>`, a feature description, or configured requirement docs. If none exists, ask for the requirement before starting.

**Output:** `cases/<slug>/analysis.md`, written in Vietnamese.

## MUST

1. **Collect the requirement.** Read the configured `requirements` block. With Jira, fetch summary, description, acceptance criteria, comments and sub-tasks through the configured Jira MCP tool. With `tracker: none`, read `requirements.docs`.
2. **Create the AC baseline.** Produce `AC-1`, `AC-2`, … as concrete pass/fail statements. Derive missing criteria from the requirement and source code, including meaningful branches, enum values and states. No later stage may silently invent a different AC baseline.
3. **Trace every AC.** Map it to the real endpoint, source branch, component or selector. Inspect `requirements.diffRepos` and the relevant feature branch; skip a repo only when its feature branch does not exist.

   **When an AC describes a computed/aggregate value** (a total, a percentage, a rounding, a date comparison, a count derived from records), extract the actual formula from the traced code and record it in the **formula ledger** — a dedicated table in `analysis.md`, one row per computed value:

   `| AC | Computed value | Formula (verbatim from code) | Source file:line | What the ticket says | Verdict |`

   `Verdict` is exactly one of:
   - **`matches ticket`** — the ticket states the formula and the code agrees. This is a trustworthy formula source for later stages.
   - **`DIFFERS from ticket → suspected bug`** — record both wordings. This is the bug-finding moment the whole pipeline exists for; flag it plainly, do not quietly adopt the code's version.
   - **`[GAP-BRS] ticket silent`** — the formula exists only in the code under test. Ask the tester (or record as a blocking ambiguity per the policy below). A formula with no business-side confirmation is not a safe basis for an expected value, no matter how carefully it was transcribed from code.

   This ledger is the **only** legitimate source of a business-decision formula later in the pipeline (`e2e-gen` cites it as `analysis.md AC-<n>`; `e2e-data` derives concrete values from it) — never a number `e2e-recon` happened to observe on screen. Plain combination arithmetic over values a case seeds itself (a sum, a count) needs no ledger row; it carries no business decision to confirm.
4. **Map state reachability.** For each required entity, setting/mode and identity, find the full chain that reaches the state. Inspect routers/controllers, OpenAPI/GraphQL and the app's own API calls. Follow chains to the terminal state; a draft-producing endpoint is not enough when a complete/approve/activate step exists.
5. **Record the state table:** required state → endpoint/UI chain → cleanup → automation rung. Reuse known chains from `project-notes.md` and append genuinely new discoveries.
6. **Write `analysis.md`** with ACs, AC-to-code traceability (including the formula ledger for computed ACs from step 3), state-reachability table, material ambiguity/assumptions and preliminary risk by area.

## Ambiguity policy

Ask the tester **only** when an ambiguity changes expected business behaviour and cannot be resolved from the requirement, source code or project notes.

For non-blocking uncertainty:
- choose the safest evidence-backed interpretation;
- record it as an explicit assumption in `analysis.md`;
- continue without a question.

If questions are required, ask at most four per round with `AskUserQuestion`.

## Completion check

Before finishing, verify:
- ACs are numbered and concrete;
- every AC has traceability;
- every AC describing a computed/aggregate value has its formula traced to `file:line` and cross-checked against the ticket, with `[GAP-BRS]` tagged where the ticket is silent;
- every required state has a reachability decision;
- unresolved business contradictions are either answered or explicitly blocked;
- `analysis.md` exists.

Suggest `/e2e gen --jira <KEY>` after completion.
