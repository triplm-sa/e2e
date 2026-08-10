import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";

// All output (screenshots, trace, html, json) is grouped per task under reports/<slug>/.
// The skill sets E2E_OUTDIR=reports/<slug> when running; falls back to reports/_scratch for manual runs.
const OUT = resolve(process.cwd(), process.env.E2E_OUTDIR ?? "reports/_scratch");

export default defineConfig({
  testDir: "cases",
  testMatch: "**/browser/**/*.spec.ts",
  timeout: 60_000,
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
    // Screenshots are captured EXPLICITLY in src/browser-fixture.ts (of the real target pages).
    // The built-in "on" mode screenshots the persistent profile's blank about:blank tab → all-white images.
    screenshot: "off",
    trace: "retain-on-failure",
    video: "off",
  },
});
