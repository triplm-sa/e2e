import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

// All output (screenshots, trace, html, json) is grouped per task under reports/<slug>/.
// The skill sets E2E_OUTDIR=reports/<slug> when running; falls back to reports/_scratch for manual runs.
const OUT = resolve(process.cwd(), process.env.E2E_OUTDIR ?? "reports/_scratch");

export default defineConfig({
  testDir: "cases",
  testMatch: "**/browser/**/*.spec.ts",

  // ---- Bounds, so a stuck run stops and explains itself instead of hanging ----
  // Each bound is deliberately tighter than the one above it, because the tighter the bound that
  // trips, the more precise the error: an action timeout names the exact locator it waited for,
  // whereas a test timeout only says the test ran too long.
  timeout: Number(process.env.E2E_TEST_TIMEOUT ?? 60_000),          // one test
  globalTimeout: Number(process.env.E2E_GLOBAL_TIMEOUT ?? 20 * 60_000), // the whole run — a hard ceiling
  maxFailures: Number(process.env.E2E_MAX_FAILURES ?? 5),           // a broken spec stops early instead of grinding
  expect: { timeout: Number(process.env.E2E_EXPECT_TIMEOUT ?? 10_000) },
  retries: 0,
  // Each worker beyond the first launches from its own snapshot of the login profile (see
  // src/profile.ts), so Chrome's per-directory lock no longer forces serial execution.
  //
  // Raising this alone changes nothing for a task with a single spec file: Playwright runs the
  // tests inside one file serially unless the file opts in with
  //   test.describe.configure({ mode: "parallel" })
  // That opt-in is deliberate — it belongs to the spec, which is the only place that knows which
  // cases share state. See the parallel-safety rules in .claude/skills/_shared/conventions.md.
  workers: Number(process.env.E2E_WORKERS ?? 4),
  outputDir: `${OUT}/artifacts`,          // screenshots + trace + video per test
  reporter: [
    ["html", { outputFolder: `${OUT}/html`, open: "never" }],   // open in a browser: reports/<slug>/html/index.html
    ["json", { outputFile: `${OUT}/report.json` }],
    ["list"],
  ],
  use: {
    // Bound every individual action and navigation, well under the per-test timeout above.
    // This is what makes a stuck test *explain itself*: without these, a hanging click burns the
    // whole test budget and reports only "Test timeout of 60000ms exceeded", naming nothing. With
    // them, the same hang fails in 15s as "locator.click: Timeout 15000ms exceeded waiting for
    // getByRole('button', { name: 'Save' })" — the cause, not just the symptom.
    actionTimeout: Number(process.env.E2E_ACTION_TIMEOUT ?? 15_000),
    navigationTimeout: Number(process.env.E2E_NAV_TIMEOUT ?? 30_000),

    // Screenshots are captured EXPLICITLY in src/browser-fixture.ts (of the real target pages).
    // The built-in "on" mode screenshots the persistent profile's blank about:blank tab → all-white images.
    screenshot: "off",
    trace: "retain-on-failure",
    video: "off",
  },
});
