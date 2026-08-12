# E2E — shared core conventions

Read this file first. **Do not load every reference automatically.** A stage should load only the references listed in its own SKILL.md. Platform-specific facts that are stable across Shopify apps live here; app-specific facts live in `project-notes.md`.

## Artifact and language rules

- One task = `cases/<slug>/`; run output = `reports/<slug>/`.
- Keep case IDs identical across analysis → plan → coverage → yaml → spec → report.
- Generated artifacts and tester-facing summaries are **Vietnamese**.
- Generated spec code and comments are **English**, except the test title mirrors the Vietnamese plan scenario and `// AC:` quotes the ticket verbatim.
- Never mark workflow progress complete until the expected artifact exists.

## Testing rules

- Every case needs a concrete business assertion. "Page loaded" is not a pass criterion.
- Console errors are evidence to inspect, not automatic failures; Shopify/storefront noise is common.
- Never diagnose an environment failure from a log line alone. Verify directly with `curl`, `pnpm e2e:doctor`, or visual evidence and quote the check.
- Targets are declared in `e2e.config.yaml` (`api` or `browser`); never hard-code a fixed target list.

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
- The configured action/assertion/navigation/test/global bounds are safety limits, not targets to wait against.

## Task layout

Input — `cases/<slug>/`: `analysis.md`, `recon.md`, `plan.md`, `coverage.md`, `data.md`, `cases.yaml`, `browser/<slug>.spec.ts`, `task.md`.

Output — `reports/<slug>/`: `report.md`, `report.csv`, `report.json`, `html/index.html`, `artifacts/`.

## Stage reference map

| Stage | Load when needed |
|---|---|
| analyze | `automation-ladder.md` |
| recon | `quality-gate.md` |
| gen | `quality-gate.md`, `automation-ladder.md`, `field-validation.md`, `api-security.md`, `non-functional.md` |
| data | `quality-gate.md`, `automation-ladder.md`, `field-validation.md` |
| run | `flaky-taxonomy.md`, `quality-gate.md` |
| flaky | `flaky-taxonomy.md`, `quality-gate.md` |
| report | `flaky-taxonomy.md` |

## Prerequisites

- API reachable through the configured health endpoint.
- Browser targets logged in with a valid Chrome profile when browser tests are required.
- Dependencies installed in `e2e/`.
- `pnpm e2e:doctor` should be used as the project-level preflight check when available.
