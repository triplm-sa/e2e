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

3. Flag every value that **mutates real data**: state how to clean it up, and leave the case manual when it would pollute a shared store.

4. Write `data.md` as a table: `| Case | Field | Value | Kind (positive/boundary/negative) | Source (real/generated) | Cleanup |`.

The result feeds two things: **chained business flows** in the API layer via `capture` and `${var}`, and concrete literal values in the browser spec.
