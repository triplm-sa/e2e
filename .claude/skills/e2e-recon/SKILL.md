---
name: e2e-recon
description: Inspect the live UI before generating a spec — walk the real flow and harvest verified selectors and real data. Triggered by /e2e recon.
---

# e2e-recon

**Role:** replace selector/data guesses with verified observations from the real browser. Do not design coverage here.

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

## Report

Write `recon.md` as:

`| Case | Element / meaning | Proposed selector | Real data | Notes |`

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

## Completion check

`recon.md` must exist and every selector used by planned UI cases must be verified or explicitly marked unavailable with a reason. If the feature is API-only, the stage may be marked `not applicable` by the orchestrator.
