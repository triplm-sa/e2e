# Test oracle — writing assertions that can actually find a bug

Load this when writing or judging an assertion whose job is to validate a computed value, not
merely presence (`e2e-gen` compiling cases, `e2e-data` sourcing expected values, `e2e-flaky`
deciding whether a fix is real). The goal is defect-detection power, not pass rate: a High-risk
case that moved from FAIL to PASS by weakening its assertion (visibility instead of a value,
`anchor` instead of `derived`) is a regression in coverage quality even though the pass count went up.

## `toBeVisible()` is usually not a value-assertion

It only proves a label exists, not that the number/date/formula next to it is correct.
- `getByText("$1,234.56").toBeVisible()` **is** a real value-assertion — that exact computed
  string has to exist to be found at all.
- `getByText("Total").toBeVisible()` after changing a filter is **not** — the label was already
  there before the filter did anything.

When an AC requires a computed value, a comparison, or "N of something" (count, amount, date,
formula result, "no NaN/Infinity"), read the actual value — `innerText()`,
`getByText(<exact computed string>)`, `toHaveText`, `toHaveCount`, or the equivalent API field —
and compare it against the expected number. A hover/interaction meant to reveal a value (tooltip,
expanded row) must assert that revealed value, not merely perform the interaction.

## `derived` vs `anchor` — where did the expected value come from

`data.md`'s `Kind` column (see `e2e-data`) labels every expected-result value as one of the two
below. `e2e-gen` hands off every value it copied from an observation (not computed) tagged
`[UNVERIFIED]` in `cases.yaml`/the spec — resolving every one of those tags to `derived` or
`anchor` is `e2e-data`'s mandatory first task, not optional polish:

- **`derived`** — computed independently from raw inputs already known, with the computation and
  its source shown in `Source`. Two cases:
  - **Plain combination arithmetic** (sum, subtract, count) over facts the tester already knows —
    e.g. "line A 150 + line B 150 = 300" — needs no further citation; addition isn't a business
    decision anyone needs to confirm.
  - **Any formula that embeds a business decision** (a rounding rule, a categorisation threshold,
    which records count as "overdue") must cite **`analysis.md`'s formula ledger**, see
    `e2e-analyze` — e.g. "per analysis.md AC-16 (ReportCreditCard.tsx:42): round(used/limit×100)".
    A formula is never sourced from `recon.md` — recon only confirms selectors and raw facts
    exist, it has no way to tell whether a displayed number is correct (see `e2e-recon`), and it
    is never invented on the spot by `e2e-gen`/`e2e-data` either — that's exactly the "formula
    copied from source code" trap below.
  A bug in the underlying calculation changes the derived number too, so the assertion can
  actually catch it.
  In order of strength: (1) tester-seeded input with a value hand-computed from it — strongest, no
  dependency on any system computing it correctly; (2) raw data pulled from a *different* system
  than the one under test (e.g. the platform's own admin API directly, not the app's own report
  endpoint), recomputed by hand per the BRS formula; (3) two genuinely separate code paths inside
  the app, only when confirmed they don't share the calculation logic.
- **`anchor`** — captured from what the UI/API currently shows, with no independent computation
  behind it. This is a regression tripwire, not proof of correctness: it can only detect that a
  number *changed*, never that it was *wrong to begin with*. Never write an `anchor` value into a
  spec as if it were verified — the spec comment must say "giá trị mốc, chưa verify công thức" so
  nobody downstream reads it as a checked value.

Three traps that produce a fake `derived`:

- **Checking one piece does not derive the whole.** A percentage-rounding formula checked against
  `Used=$X` does not make `$X` itself derived unless `$X` was independently traced to the
  orders/transactions that produced it — trace every number that feeds the assertion.
- **A formula copied from the app's own source code is not an independent source.** It only proves
  the test agrees with the implementation, not that the implementation is right. This check belongs
  to `e2e-analyze`, not here — its formula ledger should already say whether the ticket confirms
  the formula or only the code does (tagged `[GAP-BRS]` there if so). If a case still reaches
  `e2e-gen`/`e2e-data` with a business-decision formula that has no `analysis.md` citation at all,
  that's a process gap — go back to `e2e-analyze` and get it traced properly; don't invent or
  re-derive the formula from code at this later stage as a shortcut.
- **Comparing the UI to the app's own API for the same figure is not cross-source verification.**
  Both usually come from the same backend calculation, so a shared bug passes both sides. That
  comparison only proves the UI renders what the API returned. Label it for what it is ("UI
  matches API — rendering check only"), and still trace the underlying number per the ranking
  above if the case is meant to validate the calculation itself.

## A correct `derived` value can still go stale — that's a separate problem

A number computed correctly today goes stale the moment something outside the test's control
changes it (a real customer places a new order, an admin edits a limit, a due date passes and
reclassifies an order). Decide the data-ownership pattern *before* deciding the expected value —
see `automation-ladder.md`'s "When a setting is switched globally" and "Records that cannot be
deleted" for *why* each resource falls where it does; this section covers what that means for the
expected value itself:

- **Own the full lifecycle** (create in `setup` with known values, delete/restore in `teardown`)
  whenever the resource supports it — settings, members, anything reversible. A hard-coded expected
  value is safe here because nothing else can touch data scoped to this test's own run (e.g. a case
  that restores a settings field it changed, or deletes a record it created). The deciding question
  is **"does this test mutate shared state to run its scenario?"** — not "can this resource
  technically be deleted". A pure read of pre-existing data (nothing mutated) never needed a
  teardown in the first place.
- **Live baseline** when the test does not (or cannot) own the resource's lifecycle — e.g. records
  the platform never allows deleting. Never hard-code a snapshot of shared, mutable, real data as a
  literal expected value; read the *current* state at run time and derive the expectation from
  that live read (baseline, or baseline + a known delta the case itself just added). A literal
  expected total sourced from a real, shared customer's real records is exactly the failure mode to
  avoid: correct when captured, wrong the moment that customer's history changes. If the current
  case-file/spec format can't express "compare to a live-computed value" yet, flag it for
  `e2e-gen`/engine support — don't silently fall back to a hard-coded literal because the format is
  more convenient.
- Skipping cleanup on a mutation you own is not "saved by" reading a live baseline afterward — the
  baseline read would just absorb your own leftover pollution as if it were normal state. Live
  baseline copes with data you never touched; it does not excuse skipping restoration of data you did.

## Never launder a regression by rebaselining an `anchor`

Covered in full in `e2e-flaky`'s targeted-healing rule: rebaselining an `anchor` to whatever the
app currently shows requires the same evidence a new bug report would (an independent check that
the new value is right) — never just "the test now agrees with the app". A `derived` value that
starts failing is a stronger defect signal, not a stabilisation target.
