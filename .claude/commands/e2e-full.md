---
description: Run the entire E2E lifecycle for one feature through to the final report — orchestrates analyze, recon, gen (with the approval gate), data, run, flaky and report.
argument-hint: "<feature> | --jira KEY [--design f.html]"
---

The user invoked `/e2e-full $ARGUMENTS`. This command is an **orchestrator**: it runs the whole chain through to the final report by combining the stage skills.

> **Load and follow each skill with the Skill tool, in this order** — one skill per stage:
> `e2e-analyze` → `e2e-recon` → `e2e-gen` → `e2e-data` → `e2e-run` → `e2e-flaky` → `e2e-report`.
> Shared conventions: `.claude/skills/_shared/conventions.md`.

## Execution rules

- **Stop to ask the tester in only two situations:** the **plan approval gate** after `e2e-gen`, and a genuine **business-rule contradiction**. Otherwise proceed autonomously — do not interrupt with minor questions.
- **Bounded auto-healing:** the `e2e-flaky` stage fixes and re-verifies for at most **five rounds** without asking again.
- **Progress artifact:** maintain `cases/<slug>/task.md` — a checkbox per stage plus a one-line result — so the tester can follow along.
- **Missing input:** ask before starting; the run needs `--jira KEY` or a feature description.
- **Language:** these instructions are in English, but every generated artifact and tester-facing summary is written in Vietnamese.

## Sequence

1. **analyze** — load `e2e-analyze` → `analysis.md` with numbered acceptance criteria. Resolve any ambiguity that would change the tests here.
2. **recon** — load `e2e-recon` → `recon.md` with verified selectors and real data. Skip this stage when the feature touches API targets only.
3. **gen** — load `e2e-gen` → `plan.md` and `coverage.md`, then **pause at the approval gate** and present the choice via `AskUserQuestion`. Compile `cases.yaml` and the spec only after approval.
4. **data** — load `e2e-data` → `data.md`, and fill the concrete values into the yaml and spec.
5. **run** — load `e2e-run` → execute the API and browser layers → `reports/<slug>/report.md`.
6. **flaky** — load `e2e-flaky` in `fix` mode for failing or intermittent cases → auto-heal within five rounds, trusting a case only after two consecutive passes.
7. **report** — load `e2e-report` → consolidated `report.md` plus `report.csv`.

## Finish

Mark every stage complete in `task.md`, then give the tester a closing summary: total pass and fail counts, the distribution across risk ratings, which cases need a developer versus a spec review, and the link to `reports/<slug>/html/index.html`.
