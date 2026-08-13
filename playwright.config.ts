import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

// Raw browser output lives under reports/<slug>/ and is merged by src/all.ts into report.json.
const OUT = resolve(process.cwd(), process.env.E2E_OUTDIR ?? "reports/_scratch");

export default defineConfig({
  testDir: "cases",
  testMatch: "**/browser/**/*.spec.ts",
  timeout: Number(process.env.E2E_TEST_TIMEOUT ?? 60_000),
  globalTimeout: Number(process.env.E2E_GLOBAL_TIMEOUT ?? 20 * 60_000),
  maxFailures: Number(process.env.E2E_MAX_FAILURES ?? 5),
  expect: { timeout: Number(process.env.E2E_EXPECT_TIMEOUT ?? 10_000) },
  retries: 0,
  // Chrome profile snapshots are isolated per test by src/browser-fixture.ts. Raising workers does
  // not make one spec file parallel by itself; a spec must explicitly opt into parallel mode when safe.
  workers: Number(process.env.E2E_WORKERS ?? 4),
  outputDir: `${OUT}/artifacts`,
  reporter: [
    ["html", { outputFolder: `${OUT}/html`, open: "never" }],
    ["json", { outputFile: `${OUT}/report.json` }],
    ["list"],
  ],
  use: {
    actionTimeout: Number(process.env.E2E_ACTION_TIMEOUT ?? 15_000),
    navigationTimeout: Number(process.env.E2E_NAV_TIMEOUT ?? 30_000),
    screenshot: "off",
    trace: "retain-on-failure",
    video: "off",
  },
});
