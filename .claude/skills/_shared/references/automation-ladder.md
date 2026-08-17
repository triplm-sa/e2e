# Automation ladder — deciding whether a case can be automated

A case may be marked manual **only after climbing this ladder and failing every rung**. The default answer is "automate it". "Needs preparation" is a conclusion you must earn and justify, never a shortcut.

Nearly every case that looks manual is really *"I have not yet found the way to reach the required state."*

## Think in terms of REQUIRED STATE, not "test data"

The precondition is whatever the system must look like before the assertion is meaningful. It comes in three shapes, and **all three are automatable**:

| Shape | Example | Where to look |
|---|---|---|
| **Entity** exists | an order, a member, a company | create endpoints |
| **Setting / mode** is switched | account type, feature toggle, plan tier, payment term | settings endpoints, or the admin UI control |
| **Identity** is available | admin vs ordinary member, a second buyer | persona targets with their own login profile |

A precondition that is *a setting the application itself exposes* is **automatable by definition**: read the current value in setup, switch it, restore it in teardown. Writing "needs the account type changed" as a reason to skip is not acceptable — switching it is the setup step.

## The ladder

| Rung | Situation | Verdict |
|---|---|---|
| **1** | The required state already exists | Use it; the case is read-only. |
| **2** | Reachable through the **application's own API** | `phase: setup` steps. **Automatable.** |
| **3** | Reachable through **another service's API** (platform admin API, internal service) | Declare that service as a target, then setup steps. **Automatable.** |
| **4** | Reachable **only through the UI** | Automate it in the spec, or as a serial setup test. Slower, still automatable. |
| **5** | Genuinely blocked | Manual — with a per-rung justification (below). |

Rung 5 is a short list: real money movement; a token that only arrives by email or SMS; a human second factor; an action that destroys shared data with no cleanup path; a third-party system unreachable from the test environment.

## Follow the chain to the end — do not stop at the first endpoint

Reaching a state is usually **multi-step**. Finding the first endpoint is not the answer; finding the sequence that produces the state the test needs is.

| Needed state | Wrong (stops early) | Right (full chain) |
|---|---|---|
| A committed record exists | "the create endpoint only produces a draft" → skip | `create-<entity>` → **`complete-<entity>`** → the real record |
| A participant is active | "there is only an invite endpoint" → skip | invite → accept/approve → active participant |
| A record in a particular status | "existing records are all in the wrong status" → skip | create → complete **with the status the test needs** |

Before concluding a chain is a dead end, **list every mutating endpoint on the relevant router** and check whether one of them completes, approves, activates, confirms or transitions the entity. Stopping at a draft when a `complete` endpoint exists is a defect in the analysis.

Chains already discovered for the current project are recorded in `../project-notes.md`; add new ones there as you find them.

## Mandatory justification for anything marked manual

A manual case must carry an explicit per-rung verdict, so laziness is visible:

```
⚠ manual — R1 ✗ state absent · R2 ✗ no endpoint on <router> (listed: …) ·
           R3 ✗ platform API cannot set this · R4 ✗ UI control does not exist ·
           R5 ✓ token only delivered by email
```

Naming the routers you inspected is part of the justification. "Needs preparation" with no rung analysis is not a valid entry, and the plan must not be presented with one.

## Turning rungs 2–4 into steps

```yaml
- target: api
  case: SETUP-01
  phase: setup
  action: <reach the required state>
  request: { method: POST, path: /<endpoint>, body: { amount: 1500 } }   # amount is ours — known, not observed
  expect: { status: 200 }
  capture: { entityId: data.id }

- target: api
  case: SETUP-02          # continue the chain until the state is real
  phase: setup
  request: { method: POST, path: /<complete-endpoint>, body: { id: "${entityId}" } }
  expect: { status: 200 }

- target: api
  case: TD-13
  request: { method: GET, path: "/<endpoint>/${entityId}" }
  # `1500` is `derived`, not `anchor` — it's the exact amount SETUP-01 created, not a number
  # copied from what this GET happened to return. See test-oracle.md.
  expect: { status: 200, bodyMatch: { "data.total": 1500 } }

- target: api
  case: TEARDOWN-01
  phase: teardown          # always runs; restore switched settings here too
  request: { method: POST, path: /<cleanup-endpoint>, body: { id: "${entityId}" } }
  expect: { status: 200 }
```

Phase semantics: `setup` runs first and a failure there aborts the tests, which are reported SKIPPED rather than FAILED; only `test` steps are scored; `teardown` always runs, including after an abort.

## When a setting is switched globally

Switching a shop-wide mode affects every other test running against that environment. Handle it deliberately: capture the original value in setup, restore it in teardown, and group the cases that need that mode together so the switch happens once rather than per case.

This is the "own the full lifecycle" pattern in `test-oracle.md` — a hard-coded expected value is safe here specifically because teardown restores the shared state you mutated. Skipping the restore doesn't just leave a stray setting; it invalidates every hard-coded expectation in cases that read that setting afterward.

## Records that cannot be deleted

Some records — orders being the usual example — cannot be removed once created. Prefer **seeding once and asserting read-only** over creating a new record on every run, and state that choice in the plan. Where repeated creation is unavoidable, note the accumulation so the team can use a dedicated environment.

Because you don't own these records' lifecycle, never hard-code an expected value captured from them at recon time — see `test-oracle.md`'s "live baseline" pattern. Read the current state at run time instead of a frozen snapshot; real orders accumulate and change regardless of your test.
