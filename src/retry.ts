import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Re-run only the tests that failed last time, or only the ones matching a pattern.
 *
 *   pnpm e2e:retry <slug>              # only last run's failures
 *   pnpm e2e:retry <slug> TD-07        # only tests whose title matches TD-07
 *
 * While repairing a spec, re-running the whole suite to check one fix is the single largest waste
 * in the loop: a browser suite costs minutes, and the fix under test is usually one case. Playwright
 * records the last run, so `--last-failed` narrows the next run to exactly what broke.
 *
 * Run the full suite once at the end to confirm nothing else regressed.
 */
const [slug, grep] = process.argv.slice(2);
if (!slug) {
  console.error("Usage: pnpm e2e:retry <slug> [grep]");
  process.exit(1);
}

const spec = `cases/${slug}/browser/${slug}.spec.ts`;
if (!existsSync(resolve(process.cwd(), spec))) {
  console.error(`No spec at ${spec}`);
  process.exit(1);
}

const outdir = `reports/${slug}`;
const args = ["playwright", "test", spec, ...(grep ? ["-g", grep] : ["--last-failed"])];
console.log(`▸ ${grep ? `only tests matching "${grep}"` : "only last run's failures"}\n`);

try {
  execFileSync("npx", args, { stdio: "inherit", env: { ...process.env, E2E_OUTDIR: outdir } });
} catch {
  console.log(`\n▸ still failing — report: ${outdir}/report.md · html: ${outdir}/html/index.html`);
  process.exit(1);
}
console.log(`\n▸ passed. Run the full suite once before reporting: pnpm e2e:all ${slug}`);
