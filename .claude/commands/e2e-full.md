---
description: Run the entire E2E lifecycle for one feature through to the final report — orchestrates analyze, recon, gen (with the approval gate), run, flaky and report.
argument-hint: "<feature> | --jira KEY [--design f.html]"
---

The user invoked `/e2e-full $ARGUMENTS`. This command is an **orchestrator**: it runs the whole chain through to the final report by combining the stage skills.

> **Load and follow each skill with the Skill tool, in this order** — one skill per stage:
> `e2e-analyze` → `e2e-recon` → `e2e-gen` → `e2e-run` → `e2e-flaky` → `e2e-report`.
> Shared conventions: `.claude/skills/_shared/conventions.md`.

## Execution rules

- **Stop to ask the tester in only two situations:** the **plan approval gate** after `e2e-gen`, and a genuine **business-rule contradiction**. Otherwise proceed autonomously — do not interrupt with minor questions.
- **Bounded auto-healing:** the `e2e-flaky` stage fixes and re-verifies for at most **two rounds** without asking again, each round using `pnpm e2e:retry` on the specific case being fixed.
- **Time budget — 20 minutes for the whole chain** on a large feature: analyze 3 · recon 3 · gen 5 · run 4 · flaky 2 · report 1 · 2 spare. When a stage is about to overrun its share, narrow scope by risk (drop Low-risk cases first, then fold Medium ones) and **state what was cut** — never quietly run over. The re-run path for a feature that already has a spec is `/e2e run <slug>`, budgeted at **5 minutes**.

  This 4-minute share for `run` is a **soft** target for the orchestrator's own accounting, not the same number as Playwright's `globalTimeout` (default 20 minutes, in `playwright.config.ts`) — that is a **hard** safety ceiling meant to stop a genuinely hung suite and explain itself, not a normal-case duration. If `run` is trending past its 4-minute share while the suite is still healthy, narrow scope as above; do not treat "under 20 minutes" as "on budget".
- **Progress artifact:** maintain `cases/<slug>/task.md` — a checkbox per stage plus a one-line result — so the tester can follow along.
- **Missing input:** ask before starting; the run needs `--jira KEY` or a feature description.
- **Language:** these instructions are in English, but every generated artifact and tester-facing summary is written in Vietnamese.

## Sequence

1. **analyze** — load `e2e-analyze` → `analysis.md`: four tables, acceptance criteria numbered and risk-tagged. Resolve any ambiguity that would change the tests here.
2. **recon** — load `e2e-recon` → `recon.md` with verified selectors and the real data queried from the store. At this point `plan.md` does not exist yet, so recon derives the flow/routes to walk from `analysis.md`'s traceability table, not from `plan.md`. Skip this stage when the feature touches API targets only.
3. **gen** — load `e2e-gen` → `plan.md` (case table with its `Dữ liệu` column and the coverage summary line at the top; there is no separate coverage or data artifact), then **pause at the approval gate** and present the choice via `AskUserQuestion`. Compile `cases.yaml` and the spec only after approval, splitting the spec into `describe` groups and writing those groups in parallel.
4. **run** — load `e2e-run` → execute the API and browser layers → `reports/<slug>/report.md`.
5. **flaky** — load `e2e-flaky` in `fix` mode for failing or intermittent cases → auto-heal within two rounds, trusting a case only after two consecutive passes.
6. **report** — load `e2e-report` → consolidated `report.md` plus `report.csv`.

## Finish

Mark every stage complete in `task.md`, then give the tester a closing summary: total pass and fail counts, the distribution across risk ratings, which cases need a developer versus a spec review, and the link to `reports/<slug>/html/index.html`.
