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

## Case scope — business logic/flow vs. pure display

Two different things get called "a case," and they are **not** held to the same coverage bar:

- **Business logic and flow** — every enum/config value, every state transition, every validation rule, every calculation, every permission/ownership check. These are **all High priority by default** and **must each get their own case** — one value or one rule per case id, never merged, never sampled. This is where 100% coverage is measured: "config has 4 options" means 4 cases with their own assertion, not 1 case that mentions all 4 in a comment.
- **Pure visual/design display** — label wording, spacing, icon presence, colours, whether a static banner renders — where the *only* thing being checked is "does the screen look like the design," with no computed value and no business rule behind it. These **may be merged into one case** that walks the screen and asserts several elements at once, because a design mismatch is one class of bug regardless of which element shows it.

**The test:** does failing this assertion mean a wrong business decision was made (wrong price, wrong permission, wrong state), or does it mean a pixel/label is off? The former is never merged; the latter can be.

When in doubt, treat it as logic — merging a case that turns out to hide a business rule is the more expensive mistake. Record the merge decision in `coverage.md` so the tester can see which display checks were grouped and why.

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

### Running tests in parallel

Workers each launch from their own snapshot of the login profile, so several browsers can run at once. Playwright still runs the tests **inside one file serially** unless the file opts in, and that opt-in is the spec's decision because only the spec knows which cases share state.

Split the cases into groups and declare each one:

```ts
// Independent: these only read, or only touch data they created under their own name.
test.describe("wizard validation", () => {
  test.describe.configure({ mode: "parallel" });
  test("TD-60 · …", async ({ openTarget }) => { /* … */ });
});

// Shared state: anything that writes a shop-wide setting, or asserts a store-wide total.
test.describe("shipping rates", () => {
  test.describe.configure({ mode: "serial" });
  test("TD-54 · …", async ({ openTarget }) => { /* … */ });
});
```

A case belongs in a **serial** group when it:

- writes a **shop-wide setting** (another test would see the flipped value mid-run);
- **deletes by a shared prefix** or otherwise clears a collection another test is using;
- asserts a **store-wide total that the API cannot filter by namespace** — see below before accepting this.

**Two habits are mandatory while writing the spec, not optional tuning — apply them to every task:**

1. **Namespace every record the spec creates.** Tag or name fixtures with a run-scoped id, e.g. `` `E2E ${slug} w${test.info().workerIndex}-…` ``, and clean up only what matches that name. A cleanup that deletes every record with a shared prefix destroys other workers' fixtures.
2. **Scope every count/total assertion to that namespace, not to the store.** Before writing a case that asserts "list shows N" or "empty state" against the *whole* store:
   - Check whether the read endpoint accepts a filter (tag, prefix, customer group, date range). If it does, **query filtered by the run's namespace** and assert on that — this is the default, and it keeps the case parallel-safe.
   - Only when the AC is itself about a genuinely global state (e.g. "the merchant has zero options in the whole store," where a filtered count would not test the real AC) is a store-wide assertion correct. In that case put the case in the **serial** group and write one line in `plan.md` explaining why namespacing does not apply — do not silently default to serial because it is easier.

Read-only cases that never save are parallel-safe as written. Downgrading a case set to `serial` without recording which rule above applies is a plan defect, not a style choice — `e2e-gen` must justify it the same way it justifies a manual case in `automation-ladder.md`.

### What a test actually costs — reach preconditions through the API

Loading a page is the expensive operation, and for an embedded Shopify app it is far more expensive
than it looks. Measured on a real app: **7–12s per load**, of which only ~30ms is opening the tab —
the rest is Shopify Admin plus App Bridge booting inside the iframe. It does **not** get cheaper on
repeat, and reusing the tab does not help, because `page.goto` reloads Admin either way.

So the cost of a browser case is roughly *(number of page loads) × 10s* plus the assertions. That
makes one rule worth more than any other tuning:

**Never drive the UI to establish a precondition an API can set.** When the assertion is on screen B
but the setup happens on screen A, going through screen A's UI costs a full app boot and one or more
saves — 12–20s — to reach a state a single request could have set. Put it in a `phase: setup` step,
or call the API directly from the spec, and spend the browser only on what is actually being asserted.

The distinction is what the AC is about:

- AC describes **what the buyer sees** after a setting changes → set the setting via API, load only
  the buyer's page.
- AC describes **the admin screen itself** (the toggle defaults off, Save enables the save bar,
  Discard restores) → the UI is the thing under test, so drive it.

This is the same reasoning as `references/automation-ladder.md`, applied for speed rather than
reachability: there, the API is how an "unautomatable" case becomes automatable; here it is how an
automatable case stops costing a page load it never needed.

Two smaller habits, worth having but far behind the rule above:

- Prefer `waitUntil: "domcontentloaded"` over `"load"` — `"load"` also waits for every image,
  font and analytics beacon, none of which an assertion depends on.
- Fixed sleeps (`waitForTimeout`) are already forbidden; they are dead time that also hides a race
  instead of fixing it.

### Bounding a hung test — stop and state the cause

A run must always terminate on its own. Every layer is bounded in `playwright.config.ts` (browser) and
`src/api-runner.ts` (API), each overridable by an environment variable:

| Bound | Default | Env | What trips it |
|---|---|---|---|
| Action (click, fill, …) | 15s | `E2E_ACTION_TIMEOUT` | A locator that never resolves — **usually a wrong selector** |
| Assertion (`expect`) | 10s | `E2E_EXPECT_TIMEOUT` | The value never reaches the expected state |
| Navigation | 30s | `E2E_NAV_TIMEOUT` | The page never loads |
| One API request | 30s | `E2E_API_TIMEOUT` | The service accepted the connection and stopped answering |
| One test | 60s | `E2E_TEST_TIMEOUT` | The test as a whole is too slow |
| The whole run | 20 min | `E2E_GLOBAL_TIMEOUT` | Hard ceiling — the suite stops no matter what |
| Failures before aborting | 5 | `E2E_MAX_FAILURES` | A broken spec stops early instead of grinding through every case |

The inner bounds are the ones that matter, because **the tighter the bound that trips, the more precise
the diagnosis**. A bare test timeout says only "ran too long"; an action timeout names the exact locator
it waited for, which is normally the answer.

**Rules when a test hangs:**

1. **Never raise a timeout to make a hang pass.** A hang is a symptom — a wrong selector, a missing
   precondition, a state that never arrives. Raising the limit hides the cause and multiplies run time
   across every future run. Diagnose first; raise the limit only when the step is genuinely slow
   (a real checkout, a bulk import), and say why in a comment on that line.
2. **Verify the selector rather than waiting on it.** `pnpm e2e:probe <target> <route> "<selector>"`
   answers in seconds whether it matches `0` (wrong) or `>1` (ambiguous). That is the first check after
   any action timeout.
3. **Report a cause, or say the cause is unknown.** Quote the innermost failing bound and its message.
   Guessing at a cause is covered by the Evidence rule above.
4. **`maxFailures` aborting is information, not an error.** Five failures usually means one shared
   breakage (an expired session, a dead service, a renamed container), not five defects. Find that one
   cause before re-running.

When invoking the suite from a shell, pass an explicit command timeout larger than the expected suite
duration, otherwise the shell kills the run and the report never gets written.

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
