---
name: e2e-recon
description: Inspect the live UI before generating a spec — walk the real flow and harvest confirmed selectors and observed data. Triggered by /e2e recon.
---

# e2e-recon

**Role:** replace selector/data *guesses* with real observations from the browser. Do not design coverage here.

**"Verified" here means only "confirmed to exist and be reachable"** — a selector that matches, a value that's really on screen. It does **not** mean the value is mathematically/business-correct. A displayed total, percentage or computed date is exactly as likely to be wrong here as anywhere else; this stage has no way to tell.

**This stage supplies selectors and raw setup facts — never a computed expected value.** A plain identity fact (an id, a name, a status label that's just present) observed here is fine to hand to `e2e-data` as setup context. A computed/aggregate figure (a total, a percentage, a formula result) is recorded only to confirm the *selector* that will read it exists — its formula must come from `analysis.md`'s AC-to-code trace (see `e2e-analyze`), and the concrete number for a given run comes from `test-oracle.md`'s derivation rules, not from this stage. Never let a number captured here travel into `cases.yaml`/spec as an expected value on its own authority.

**Load first:** `../_shared/core.md`.
**Load when needed:** `../_shared/references/quality-gate.md`, `../_shared/project-notes.md`.

**Input:** `<slug>` with `analysis.md`, `plan.md` or `cases.yaml`; or a URL/route plus a flow description. In `/e2e-full`, `analysis.md` is the normal input. Ask only if none is available.

**Output:** `cases/<slug>/recon.md`, written in Vietnamese.

## MUST

1. Load the claude-in-chrome tools once if deferred.
2. Call `tabs_context_mcp`, then create a new tab unless reuse was requested.
3. Navigate → resize to 1920×1080 → wait for load → `read_page`. Use accessibility snapshots as the primary DOM source; screenshots are evidence when the snapshot cannot expose the needed state.
4. Walk only the required flow. For embedded Shopify Admin targets use Admin → app iframe → route.
5. Handle iframe, shadow DOM, SPA navigation, tables, overlays and modals explicitly. Record anything `read_page` cannot reach.
6. Harvest a stable selector and real data for every element the eventual tests must use. Prefer role/label/text → testid → id → CSS → XPath last.
7. Batch-probe selectors with `pnpm e2e:probe <target> <route> "<selector>" …` before handing them to generation.
8. **Prefer text/DOM inspection over screenshots.** Use `read_page`, targeted find/query tools, or direct API/DOM inspection when the question is about labels, values, table columns, structure, or selector availability. Take a screenshot only when visual evidence is actually required: layout, position, overlap, visibility, responsive behavior, visual state, or appearance. **Exception:** for content inside a cross-origin iframe (e.g. an embedded CMS app), `read_page`/`find` may not reach it at all — confirm reachability first; when the accessibility tree genuinely returns nothing for that region, a screenshot is required evidence, not an optional fallback.

## Report

Write `recon.md` as:

`| Case | Element / meaning | Proposed selector | Real data | Notes |`

`Real data` is what was observed on screen at this moment — not a claim that the value is correct, and not a candidate expected value. Flag in `Notes` when an entry is a computed/aggregate figure (a total, a percentage, a count) rather than a raw identity fact — `e2e-gen` must source that field's expected value from `analysis.md`'s formula ledger instead, never by copying this column.

Also record:
- route/structure discoveries that contradict assumptions;
- documentation-versus-implementation gaps;
- iframe/shadow/overlay constraints;
- suspicious console findings, without diagnosing from console noise alone.

If an existing spec contains `[NEEDS-SELECTOR-REVIEW]` placeholders, propose replacements but apply them only when the user explicitly asks for the edit.

## Cautions

- Never trigger `alert`, `confirm` or `prompt`.
- After two or three futile interactions, stop and report the blocker instead of looping.
- Do not browse large DOM snapshots without a specific target.
- Do not take screenshots merely to duplicate information already available through DOM/text inspection.
- Do not skip a screenshot for cross-origin iframe content on the assumption that DOM inspection "should" cover it — verify it actually returned data before relying on it.

## Completion check

`recon.md` must exist and every selector used by planned UI cases must be verified or explicitly marked unavailable with a reason. If the feature is API-only, the stage may be marked `not applicable` by the orchestrator.
