# E2E — shared conventions

Read the relevant sections from every `e2e-*` skill. The harness lives in `e2e/` and is config-driven via `e2e/e2e.config.yaml`.

**Where knowledge belongs.** The harness targets Shopify apps, so **platform-level facts stay here** — admin deep links, embedded-app iframes, storefront console noise, session and 2FA handling. What must *not* live here is knowledge of **one particular app**: its target names, app handle, endpoint chains, personas and environment URLs. Those belong in `project-notes.md`, the single file to replace when adopting the harness for another app. Keep the rules in this folder true for any Shopify app.

One task = one folder `cases/<slug>/`; run output goes to `reports/<slug>/`. `<slug>` = the ticket key (e.g. `PROJ-123`) or a feature name. Keep **case ids consistent** across analysis → plan → coverage → yaml → spec → report.

## Language policy

- **These instruction files are in English.** Skills, commands and references.
- **Every generated artifact is written in Vietnamese** — the tester audience is Vietnamese. This applies to `analysis.md`, `plan.md`, `coverage.md`, `data.md`, `recon.md`, `task.md`, `report.md`, `report.csv`, and any summary shown in chat.
- Inside those Vietnamese documents, keep identifiers verbatim: file paths, commands, code symbols, HTTP methods, config keys.
- **Generated spec code** (`browser/<slug>.spec.ts`) uses **English** comments and precondition messages. Two exceptions: the `test("<id> · <scenario>")` title mirrors the plan case so the HTML report stays readable for the tester, and `// AC:` quotes are copied verbatim from the ticket.

## Testing philosophy

- Verify **business logic and user flows like a real user** — not just console output. Every case needs a **concrete business assertion** (computed value, rendered content, state after an action). Never stop at "the page loaded".
- Console errors (`[console.error]` / `[pageerror]` / `[requestfailed]`) are recorded in the report but are **not** a pass criterion. The Shopify storefront constantly emits unrelated output (analytics, CSP reports, third-party scripts), so never assert `expect(consoleErrors).toEqual([])`.

## Evidence rule — never diagnose from a log line alone

Console output is a **weak signal**. It may never be the sole basis for any conclusion, and in particular never for a claim that the environment is broken.

- The fixture tags each captured message with its origin. Anything marked `NOISE` — a browser extension, a dev-tool websocket, a third-party host — is **not evidence about the application**. Do not build a diagnosis on it.
- Before asserting that infrastructure is down (tunnel dead, API unreachable, session expired), run a **direct check and quote its output**: `curl -o /dev/null -w '%{http_code}' <url>`, `pnpm e2e:doctor`, or a screenshot showing the page failed to render. No verification, no claim.
- When the cause is genuinely unclear, say so and list what was checked. An honest "unclear, here is what I ruled out" is correct; a confident wrong attribution wastes the team's time and can send a healthy service to be "fixed".
- The same rule applies in reverse: do not dismiss a real failure as noise without checking its origin tag.
- Targets are declared in `e2e.config.yaml` (`kind: api|browser`). Never hard-code a fixed set of layers.

## Task folder layout

Input — `cases/<slug>/`: `analysis.md` (analyze) · `recon.md` (recon) · `plan.md` (gen, human-readable) · `coverage.md` (gen, AC matrix) · `data.md` (data) · `cases.yaml` (machine) · `browser/<slug>.spec.ts` · `task.md` (full-flow progress).

Output — `reports/<slug>/`: `report.md` · `report.csv` · `report.json` · `html/index.html` · `artifacts/`.

## Embedded admin apps — always Shopify Admin → app (iframe) → route

An app embedded in Shopify Admin must be reached through the Admin, never at its own domain: going direct bypasses the Shopify session and App Bridge, and it is not the flow a merchant takes.

Such a target declares `baseUrl` as the **Admin deep link** — `https://admin.shopify.com/store/<store>/apps/<app-handle>`, with routes appended — and `appIframeSrc`, the host of the iframe the app renders in. Every interaction goes through that frame:

```ts
const app = page.frameLocator('iframe[src*="<appIframeSrc>"]');
// Every interaction and assertion goes through `app`, never the outer `page`.
```

Store and app handle come from `.env` (`${STORE}`, `${APP_HANDLE}`); which targets are embedded is recorded in `project-notes.md`.

## Reliability rules for Playwright specs

1. **Traceability** — every business assertion carries `// AC: <quote from ticket>`.
2. **Separate preconditions** — check platform/element existence first, with a message prefixed `[NEEDS-SELECTOR-REVIEW]`. A failure there is a spec/environment problem, **not** a feature defect. Only unprefixed business assertions can conclude the feature is wrong.
3. **Assert strictly** — check concrete values and computations, not merely "the element exists".
4. **Smart waits and locators** — `waitForTimeout` and fixed sleeps are forbidden; use web-first assertions. Locator priority: role/label/text → testid → id → CSS → XPath last. Details in `references/quality-gate.md` sections C and D.

### Browser spec template

Replace the target name, route and selectors with the real ones for the feature under test; keep the structure.

```ts
import { test, expect } from "../../../src/browser-fixture.js";

test("TD-01 · <mô tả tình huống lấy từ plan.md>", async ({ openTarget, consoleErrors }) => {
  const page = await openTarget("<target>");            // name declared in e2e.config.yaml
  await page.goto("/<route>", { waitUntil: "load" });

  // PRECONDITION (environment/selector, not the feature): the container must be present.
  await expect(
    page.getByTestId("<container>"),
    "[NEEDS-SELECTOR-REVIEW] container not found",
  ).toBeVisible({ timeout: 15_000 });

  // AC: "<quote the acceptance criterion verbatim from the ticket>"
  const total = page.getByTestId("<value-under-test>");
  await expect(total).toBeVisible({ timeout: 10_000 });
  await expect(total).toContainText("<expected label>");   // correct label
  await expect(total).toHaveText("1.234.500 ₫");           // exact computed value, not just "exists"

  // Console output is logged only — never a hard failure (platforms emit unrelated noise).
  if (consoleErrors.length) console.log(`[info] ${consoleErrors.length} console error(s) — see report`);
});
```

For a target whose UI is embedded in an iframe, obtain the frame first (see the section above) and run every locator through it instead of `page`.

Set `E2E_CONFIG` when running browser specs from outside the `e2e/` directory.

## Prerequisites before running

- API reachable: `curl <api.baseUrl>/health/live` (or `/life-check`).
- Browser targets logged in: `/e2e login <target>`, profile still valid; real **Google Chrome** installed (`channel: chrome`).
- `pnpm install` completed in `e2e/`.
- `pnpm e2e:doctor` verifies all of the above and reports each item as pass/fail.
