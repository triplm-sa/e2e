---
name: e2e-recon
description: Inspect the live UI through the browser (claude-in-chrome MCP) before generating a spec — walk the real flow, handle iframe/shadow DOM/SPA, and harvest stable selectors plus real data. Triggered by /e2e recon.
---

# e2e-recon

Harvest **real selectors and real data** so the generated spec contains verified locators instead of guesses — which is what keeps `[NEEDS-SELECTOR-REVIEW]` failures and environment noise low.

This skill drives **claude-in-chrome**: the tester's own Chrome, already signed in, so no separate login is needed.

Shared conventions: `../_shared/conventions.md`.

**Input:** `<slug>` (with an existing `plan.md` or `cases.yaml` so the flow to inspect is known), or a URL/route plus a description of the flow. Ask the tester if neither is available. Check `../_shared/project-notes.md` for which targets are embedded in Shopify Admin and therefore need frame handling; when it says nothing, the `appIframeSrc` field in `e2e.config.yaml` tells you the same thing.

**Output:** `cases/<slug>/recon.md`, **written in Vietnamese** (see the language policy in conventions).

## Load the tools once

If the browser tools are deferred, load them in a single call:

`ToolSearch("select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__read_console_messages")`

## Steps

1. Call `tabs_context_mcp` to see the current tabs, then **open a new tab** with `tabs_create_mcp` unless the tester asked to reuse an existing one.
2. **Navigate → resize to 1920×1080 → wait for load → `read_page`** for the accessibility snapshot. Use the snapshot to analyse the DOM (it carries element refs); use screenshots only as evidence.
3. Walk the flow exactly as a user would, following `plan.md`. For the **cms** target, go through Admin → the app → the route; the app UI lives inside an **iframe**, so read the corresponding frame.
4. Handle the awkward cases explicitly: cross-origin iframes, shadow DOM, SPA navigation, tables, overlays and modals. Note where `read_page` cannot reach and screenshots are required instead.
5. **Harvest.** For every element the tests must assert on, record a **stable selector** (prefer role/label/text/testid — see `../_shared/references/quality-gate.md` section D) and the **real data** available on the store (ids, handles, emails).
6. Read `read_console_messages` (filter by pattern when noisy) and note anything suspicious.

## Report

Write `recon.md` as a table: `| Case | Element / meaning | Proposed selector | Real data | Notes (iframe, overlay…) |`.

Also record two kinds of finding, because they are the main value of this stage:
- **Route and structure discoveries** that contradict assumptions (for example a settings tab rather than a dedicated route).
- **Documentation-versus-implementation gaps** — controls described in the ticket that do not exist, or defects visible on screen. Report these before any test is written.

When a spec already exists, propose replacing its `[NEEDS-SELECTOR-REVIEW]` placeholders with the verified selectors, and apply the change only with the tester's agreement.

## Cautions

- Do not trigger `alert`, `confirm` or `prompt` dialogs — they block the extension.
- Do not repeat futile interactions; after two or three failed attempts, stop and report to the tester.
- Reading large DOM snapshots is expensive, so inspect with a purpose rather than browsing broadly.
