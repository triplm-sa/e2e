# E2E — shared core conventions

This file is the small, always-relevant contract. **Do not load every reference automatically.** Each stage loads only the references listed in its SKILL.md. Platform-specific facts that are stable across Shopify apps live here; app-specific facts live in `project-notes.md`.

## Artifact and language rules

- One task = `cases/<slug>/`; run output = `reports/<slug>/`.
- Keep case IDs identical across analysis → plan → coverage → coverage.json → yaml → spec → report.
- Generated artifacts and tester-facing summaries are **Vietnamese**.
- Generated spec code/comments are **English**, except the test title mirrors the plan scenario and `// AC:` quotes the ticket verbatim.
- Never mark workflow progress complete until the expected artifact exists.

## Testing rules

- Every case needs a concrete business assertion. "Page loaded" is not a pass criterion.
- Console errors are evidence to inspect, not automatic failures; Shopify/storefront noise is common.
- Never diagnose an environment failure from a log line alone. Verify directly with `curl`, `pnpm e2e:doctor`, or visual evidence and quote the check.
- Targets are declared in `e2e.config.yaml` (`api` or `browser`); never hard-code a fixed target list.
- The case table in `report.html` shows real input/output, not a generic "status 200 + N bodyMatch ok". API steps get this automatically. For a browser case where the concrete data matters to the reader (not obvious from the scenario text), call `recordIO(testInfo, input, output)` from `browser-fixture.ts` with what was actually set up and observed — e.g. `recordIO(testInfo, "member id=42, role=Default", "role badge = 'Default'")`.

## Embedded Shopify Admin apps

Embedded apps must be reached through Shopify Admin → app iframe → route. Do not navigate directly to the app domain for a CMS target.

```ts
const app = page.frameLocator('iframe[src*="<appIframeSrc>"]');
// Interactions and assertions for the embedded app go through `app`.
```

Store/app handle and target-specific details come from `.env`, `e2e.config.yaml`, and `project-notes.md`.

## Playwright reliability

1. Every business assertion carries `// AC: <ticket text>`.
2. Platform/selector preconditions use an assertion message prefixed `[NEEDS-SELECTOR-REVIEW]`. Such failures are not feature defects.
3. Assert concrete values and computations, not mere existence.
4. Never use fixed sleeps. Prefer web-first assertions and stable locators: role/label/text → testid → id → CSS → XPath last.
5. When a selector is uncertain, probe it before running the spec.
6. Browser cases should be parallel by default only when their data is isolated. Shop-wide writes, shared cleanup and store-wide totals require serial grouping.
7. Namespace created data by worker/case and clean only that namespace.

## Cost and timeout rules

- Never use UI to establish a precondition that an API can establish. Put it in `phase: setup` and reserve the browser for the behavior under test.
- Use `waitUntil: "domcontentloaded"` when the assertion does not depend on full resource loading.
- Never increase a timeout to hide a hang. Diagnose the innermost timeout first and probe the selector when an action times out.
- **Do not make the model transport data that tooling can transport directly.** Copy, move, merge, filter, or transform generated artifacts with shell/project tooling instead of reproducing large blocks through the model. Treat machine-generated tables and evidence as immutable unless a semantic correction is required.
- **Batch independent tool work.** When multiple Bash/scripts/probes are independent, run them in one tool turn or one combined script. Keep dependent commands sequential when a later command needs an earlier result.
- Prefer background execution plus the available monitor/await mechanism for long-running E2E commands. If polling is unavoidable, read only new output since the previous checkpoint rather than repeatedly tailing the entire log.
- Prefer text/DOM/API evidence over screenshots when the question does not require visual evidence. Use screenshots for layout, position, overlap, visibility, responsive behavior, visual state, or other genuinely visual questions.

## Task layout

Input — `cases/<slug>/`: `analysis.md`, `recon.md`, `plan.md`, `coverage.md`, `coverage.json`, `data.md`, `cases.yaml`, `browser/<slug>.spec.ts`, `task.md`.

Output — `reports/<slug>/`: **`report.html`** is the only file a human opens — one self-contained page (case table, bug analysis, embedded screenshots for failed cases; no external file, image or stylesheet). **`report.csv`** sits next to it — the one artifact meant to leave the repo (import into Sheets/Jira/TestRail). Everything else machine-generated lives under `reports/<slug>/data/`: `report.json` (execution truth), `report.generated.md`, `api-report.json`, `browser-report.json`, `analysis.md` (tester-authored bug/coverage prose, source for `report.html`), Playwright's own `html/index.html` (interactive trace viewer), `artifacts/`, `retry/`. Build/rebuild the final page with `pnpm e2e:report:build <slug>` after editing `data/analysis.md`.

## Prerequisites

- API reachable through the configured health endpoint when an API target is used.
- Browser targets logged in with a valid Chrome profile when browser tests are required.
- Dependencies installed in `e2e/`.
- `pnpm e2e:doctor` should be used as the project-level preflight check when available.
