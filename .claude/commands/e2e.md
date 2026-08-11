---
description: Full-lifecycle E2E QA — invoke a single stage skill (analyze, recon, gen, run, flaky, report) or save a login session. For the whole chain, use /e2e-full.
argument-hint: "analyze|recon|gen|run|flaky|report <slug|--jira KEY> | login [target]"
---

The user invoked `/e2e $ARGUMENTS`. This command is a dispatcher: it runs **one stage skill** based on the first subcommand. Load the matching skill with the Skill tool, pass the remaining arguments to it, and follow its instructions.

| Subcommand | Skill to load |
|---|---|
| `analyze [feature] [--jira KEY]` | `e2e-analyze` |
| `recon <slug>` | `e2e-recon` |
| `gen [feature] [--jira KEY] [--design f.html]` | `e2e-gen` |
| `run <slug>` | `e2e-run` |
| `flaky <slug> [fix]` | `e2e-flaky` |
| `report <slug>` | `e2e-report` |

**`login [target=cms]`** has no skill — run it directly in the background: `cd e2e && pnpm e2e:login <target>`.

- For a `chrome-profile` target such as `cms`: real Chrome opens with the dedicated profile at `loginUrl`. The tester signs in to Shopify (email, password and the 2FA code), opens the app, then **closes the window** — the session is saved into the profile, with no keypress required.
- For a `storage-state` target: the tester signs in, then presses ENTER to save `.auth/*.json`.

Watch the background output until the saved-session message appears. Sessions expire over time, so re-run this when a test is redirected to a login page.

To run **the entire chain through to the final report**, use `/e2e-full <feature | --jira KEY>`.

With no subcommand, ask the tester which stage to run, or whether to run `/e2e-full`.

Reminder: instruction files are in English, but every generated artifact and tester-facing summary is written in Vietnamese — see `.claude/skills/_shared/conventions.md`.
