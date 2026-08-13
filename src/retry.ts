import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const [slug, grep] = process.argv.slice(2);
if (!slug) { console.error("Usage: pnpm e2e:retry <slug> [grep]"); process.exit(1); }

const spec = `cases/${slug}/browser/${slug}.spec.ts`;
if (!existsSync(resolve(process.cwd(), spec))) { console.error(`No spec at ${spec}`); process.exit(1); }

// Retry output must never replace the canonical merged report.json. It is evidence for the repair loop.
const outdir = `reports/${slug}/retry`;
const args = ["playwright", "test", spec, ...(grep ? ["-g", grep] : ["--last-failed"])];
console.log(`▸ ${grep ? `only tests matching \"${grep}\"` : "only last run's failures"}\n`);

try {
  execFileSync("npx", args, { stdio: "inherit", env: { ...process.env, E2E_OUTDIR: outdir } });
} catch {
  console.log(`\n▸ still failing — retry evidence: ${outdir}/report.json · html: ${outdir}/html/index.html`);
  process.exit(1);
}
console.log(`\n▸ passed. Run the full suite once before reporting: pnpm e2e:all ${slug}`);
