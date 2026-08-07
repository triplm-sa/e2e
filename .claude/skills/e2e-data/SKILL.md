---
name: e2e-data
description: Prepare concrete test data for a task — either discover real values on the store (ids, handles, emails) or generate unique, traceable values covering positive, boundary and negative inputs. Triggered by /e2e data.
---

# e2e-data

Provide **concrete test data** so the plan, yaml and spec never rely on vague values such as "a valid email".

Shared conventions: `../_shared/conventions.md`.

**Input:** `<slug>`, with `plan.md` or `cases.yaml` already present. Ask the tester if missing.

**Output:** `cases/<slug>/data.md`, **written in Vietnamese** (see the language policy in conventions).

## Steps

1. Read `plan.md` and `cases.yaml` to determine which cases need which data.

2. Choose a source per case:
   - **Discover real data on the store** — preferred when the case runs against a real environment. Query the `api` target (curl with the runner's signed auth, or a small `tsx` script) to obtain ids, handles and emails that genuinely exist, then use them in the yaml and spec instead of assumptions.
   - **Generate new data** — when the case must create or type a value. Follow `../_shared/references/quality-gate.md`: make values unique and traceable using a `[prefix]_[case]_[timestamp]_[random]` shape, and cover **positive, boundary and negative** variants using the groups in `../_shared/references/field-validation.md`. For multi-dimensional combinations use **pairwise** and record the matrix along with any dropped combinations and the reason.

3. **Prefer reaching the state yourself over asking a human for it.** Check `../_shared/project-notes.md` for chains already known for this app — it may be empty, in which case discover them and **append what you find so the next task inherits it**. Then follow `../_shared/references/automation-ladder.md`: when an endpoint can produce the entity, express it as `phase: setup` steps in `cases.yaml` (with `phase: teardown` cleanup) rather than recording it as a manual prerequisite. Reserve manual preparation for entities no rung of the ladder can create.

4. Flag every value that **mutates real data**: state how to clean it up. For records that cannot be deleted — orders being the usual case — seed once and assert read-only instead of creating a new record on every run.

5. Write `data.md` as a table: `| Case | Field | Value | Kind (positive/boundary/negative) | Source (existing/setup-step/generated) | Cleanup |`.

The result feeds two things: **chained business flows** in the API layer via `capture` and `${var}`, and concrete literal values in the browser spec.
