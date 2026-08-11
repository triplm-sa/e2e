---
name: e2e-recon
description: Inspect the live UI through the browser (claude-in-chrome MCP) before generating a spec — walk the real flow, handle iframe/shadow DOM/SPA, and harvest stable selectors plus real data. Triggered by /e2e recon.
---

# e2e-recon

Harvest **real selectors and real data** so the generated spec contains verified locators instead of guesses — which is what keeps `[NEEDS-SELECTOR-REVIEW]` failures and environment noise low.

This skill drives **claude-in-chrome**: the tester's own Chrome, already signed in, so no separate login is needed.

Shared conventions: `../_shared/conventions.md`.

**Input** — two scenarios, pick the one that matches where the task actually is:

- **First pass (the normal case in `/e2e-full`: recon runs before `e2e-gen`, so `plan.md` does not exist yet).** Read `cases/<slug>/analysis.md` — its traceability table (`AC` → `File:line / endpoint / selector`) tells you which routes and flows the ACs touch. Derive the flow to walk from that; ask the tester for the entry route only when the traceability table doesn't make it obvious (e.g. an endpoint with no corresponding UI route found yet).
- **Re-recon (a spec already exists and selectors need refreshing).** Use the existing `plan.md` or `cases.yaml`, which already names the flow to inspect.

Ask the tester if neither `analysis.md` nor `plan.md`/`cases.yaml` is available. Check `../_shared/project-notes.md` for which targets are embedded in Shopify Admin and therefore need frame handling; when it says nothing, the `appIframeSrc` field in `e2e.config.yaml` tells you the same thing.

**Output:** `cases/<slug>/recon.md`, **written in Vietnamese** (see the language policy in conventions).

## Load the tools once

If the browser tools are deferred, load them in a single call:

`ToolSearch("select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__read_console_messages")`

## Steps

1. Call `tabs_context_mcp` to see the current tabs, then **open a new tab** with `tabs_create_mcp` unless the tester asked to reuse an existing one.
2. **Navigate → resize to 1920×1080 → wait for load → `read_page`** for the accessibility snapshot. Use the snapshot to analyse the DOM (it carries element refs); use screenshots only as evidence.

   **Exactly one `read_page` per new route, no more.** The first snapshot is for understanding the page structure. After that, locate specific elements with a targeted `find` — name the element you need instead of re-capturing the whole page. **Do not `read_page` a second time on the same route** merely because its state changed (a modal opened, the wizard advanced a step): use `find` in the new state. Recon is the stage most likely to overrun its time budget, and repeated full-page snapshots of an app embedded in Shopify Admin are the most expensive thing in the entire chain.
3. Walk the flow exactly as a user would. When `plan.md` already exists, follow it case by case; on a first pass (no `plan.md` yet), follow the routes/flows derived from `analysis.md`'s traceability table instead. For the **cms** target, go through Admin → the app → the route; the app UI lives inside an **iframe**, so read the corresponding frame.
4. Handle the awkward cases explicitly: cross-origin iframes, shadow DOM, SPA navigation, tables, overlays and modals. Note where `read_page` cannot reach and screenshots are required instead.
5. **Harvest.** For every element the tests must assert on, record a **stable selector** and the **real data** available on the store (ids, handles, emails). Three rules decide what a selector may look like — apply them **here, at harvest time**, because this table is the only place selectors are ever chosen:

   - **Anchor every selector inside a container; never scan the whole page.** Identify the region first — `getByRole('alert')`, the form area of a wizard step, a specific table — then find the element *within* it. An unanchored selector matches whatever else the page happens to say: a text lookup for a field label has been known to also match a navigation link with a similar name, which surfaces only at run time as a strict-mode violation.
   - **Follow the locator priority in `../_shared/references/quality-gate.md` section D, and treat `getByText` as the last resort.** Prefer `getByRole` and `getByLabel`. On a component-library UI with no test attributes, a bare text lookup is ambiguous far more often than it looks, and it also breaks the moment the interface is translated — selectors bound to English UI strings from a locale file are selectors with an expiry date.
   - **For any field that opens a picker, modal or popover, establish how the selection commits — never infer it from a familiar pattern.** Finding the trigger is half a job. The control either commits on click, or holds the choice in its own local state until an explicit button is pressed, in which case dismissing it by Cancel, click-outside or Escape **discards the selection entirely**. These two need opposite interaction sequences, and they look identical from the outside.

     Determine which it is by **opening it** — click the trigger, then `find` or `read_page` the opened state and look for a confirm button — or, when opening it live is not possible, by **reading the component source** in the diff repositories already checked out. Record what you found; a picker whose commit mechanism is unknown is a picker not yet reconned.

     Check for these specifically, because each has produced a wrong spec: a **confirm button whose label is not the obvious one** (`Select`, `Continue` and `Done` are as common as `Add`, and two versions of the same picker can differ); a confirm button that is **`disabled` until something is selected**, which behaves like a missing button and burns the whole action timeout reporting only that the locator never became stable; and a **multi-step** modal whose button label changes per step. `../_shared/project-notes.md` records what is already known for this app under **UI interaction patterns** — start there, and **append anything new so the next task inherits it**. On a new app that section is **empty, which is normal, not an error**: an empty table means nothing has been checked yet, never that nothing needs checking. Verify from the live control or the component source and write the findings in.

   - **A selector read from source code is a hypothesis, not a finding.** Source tells you an element *exists*; it cannot tell you the selector matches **exactly one** element on the rendered page, and uniqueness is what makes a spec run. Every such selector goes through step 6 before it may be used.
6. **Verify every selector — one probe call per route, not per case.** This stage is the **only** place selectors are verified; `e2e-gen` does not open a browser at all, so a selector leaving here unverified is never checked again until the suite runs and fails.

   `pnpm e2e:probe <target> <route> "<selector>" "<selector>" …` launches one browser, loads the route once, and then checks **every selector passed to it** against that single page. The cost is therefore in the **number of calls**, not the number of selectors. Group all selectors for a route into **one call per route** — a handful of calls, seconds each. Batching per case instead multiplies browser launches by the number of cases, and on an app embedded in Shopify Admin each launch pays the app boot again.

   Record the verdict in the table's `Đã xác minh` column: `✅` for exactly one match, or the failure verbatim — `0 match` means the selector is wrong, `>1 match` means ambiguous and it *will* be flaky. Fix and re-probe rather than writing a known-bad selector into the table.

   **When a route cannot be probed at all** — the app will not boot, an upstream service is undeployed, the session expired — do **not** stop the chain, and do **not** quietly pass the selector off as good. Mark those rows `⚠️ chưa xác minh` with the reason, and say so plainly at the approval gate so the tester decides whether to proceed or wait. Cases resting on those selectors still get written and still run, but a failure among them is **not** evidence of a feature defect: `e2e-gen` marks them and `e2e-run` reports them as not-yet-verified, the same treatment a test gets when its `phase: setup` never succeeded. Reporting an unverified selector as a product bug wastes a developer's time and costs more trust than a slow run ever does.

7. **Query the store for real data.** This moved here from the removed data stage, because recon already has a browser open on the very store in question. For every case that needs an existing entity, obtain **verified real values** — ids, handles, emails, product codes, currency — by calling the `api` target (curl with the runner's signed auth, or a small `tsx` script), not by reading them off the UI and copying them across. Record them in the `Dữ liệu thật` column of the recon table; `e2e-gen` will carry them into the `Dữ liệu` column of `plan.md`.

   **Prefer reaching a state yourself over asking a human for it.** Check `../_shared/project-notes.md` for chains already known for this app — it may be empty, in which case discover them and **append what you find so the next task inherits it**. Then follow `../_shared/references/automation-ladder.md`: when an endpoint can produce the entity, express it as `phase: setup` steps (with `phase: teardown` cleanup) rather than recording a manual prerequisite. Reserve manual preparation for entities no rung of the ladder can create. For records that cannot be deleted — orders being the usual case — seed once and assert read-only instead of creating a new record on every run.

8. Read `read_console_messages` (filter by pattern when noisy) and note anything suspicious.

## Report

Write `recon.md` as a table: `| Case | Route | Phần tử / ý nghĩa | Selector | Đã xác minh | Dữ liệu thật | Ghi chú (iframe, overlay…) |`.

The `Selector` column must cover **the whole interaction, not just how to find the field**. For a
picker or modal that needs an explicit confirm, the cell holds both the trigger *and* the confirm
button with its exact label — `getByLabel('<field>')` → the item → `getByRole('button', { name: '<confirm label>' })`.
A cell naming only the trigger is what lets a spec be written as "click the item and move on", which
then fails on a later business assertion and gets misread as a product bug. When the control commits
on click with no confirm button, say so explicitly in `Notes`; silence there is indistinguishable
from not having checked.

The `Đã xác minh` column is what makes this table usable, so it is never left blank: `✅` when the probe in step 6 reported exactly one match, or `⚠️ chưa xác minh` plus the reason when the route could not be probed. `e2e-gen` copies selectors from this table verbatim and has no browser of its own, so an empty verdict here means nobody ever checked that selector.

`pnpm e2e:probe` runs headless on a copy of the login profile, so it neither fights a running suite nor risks the real profile, and it reports the ambiguous selectors that a single successful click would have hidden.

Also record two kinds of finding, because they are the main value of this stage:
- **Route and structure discoveries** that contradict assumptions (for example a settings tab rather than a dedicated route).
- **Documentation-versus-implementation gaps** — controls described in the ticket that do not exist, or defects visible on screen. Report these before any test is written.

When a spec already exists, propose replacing its `[NEEDS-SELECTOR-REVIEW]` placeholders with the verified selectors, and apply the change only with the tester's agreement.

## Cautions

- Do not trigger `alert`, `confirm` or `prompt` dialogs — they block the extension.
- Do not repeat futile interactions; after two or three failed attempts, stop and report to the tester.
- Reading large DOM snapshots is expensive — it is the single biggest cost of this stage. One `read_page` per new route, then targeted `find` only. Never browse broadly just to see what is there.
