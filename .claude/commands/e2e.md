---
description: Full-lifecycle E2E QA — invoke one stage skill (analyze, recon, gen, data, run, flaky, report) or save a login session. For the whole chain, use /e2e-full.
argument-hint: "analyze|recon|gen|data|run|flaky|report <slug|--jira KEY> | login [target]"
---

The user invoked `/e2e $ARGUMENTS`. This command is a **dispatcher**: load exactly one matching stage skill and pass the remaining arguments to it.

| Subcommand | Skill |
|---|---|
| `analyze [feature] [--jira KEY]` | `e2e-analyze` |
| `recon <slug>` | `e2e-recon` |
| `gen [feature] [--jira KEY] [--design f.html]` | `e2e-gen` |
| `data <slug>` | `e2e-data` |
| `run <slug>` | `e2e-run` |
| `flaky <slug> [fix]` | `e2e-flaky` |
| `report <slug>` | `e2e-report` |

Load `.claude/skills/_shared/core.md` before dispatching. A stage must load only the references declared by that skill.

**`login [target=cms]`** has no skill — run `cd e2e && pnpm e2e:login <target>` directly and watch the background output until the saved-session message appears. For `chrome-profile`, close the real Chrome window after signing in; for `storage-state`, press ENTER to save `.auth/*.json`.

Sessions expire. Re-run login when a test is redirected to a login page.

For the entire chain through the final report, use `/e2e-full <feature | --jira KEY>`.

With no subcommand, ask which stage to run or whether to start `/e2e-full`.
