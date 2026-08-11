import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { mergeReports, countSpecs, type Report } from "./merge-report.js";

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
 * **This never writes into `reports/<slug>/` directly.** Playwright's html and json reporters
 * overwrite their output folder with exactly what the current invocation ran, so pointing a
 * `--last-failed` run at the task's report folder used to replace a full run's report with the
 * handful of re-run cases — every case that had passed vanished from `html/index.html` while still
 * being green in reality. Each retry therefore gets its own folder, and the canonical
 * `reports/<slug>/report.json` is updated by merging, newest result per case wins.
 *
 * The canonical `html/index.html` still shows the last **full** run, because Playwright can only
 * produce that HTML from a run, not from merged JSON. Run the full suite once before reporting.
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

const taskDir = `reports/${slug}`;
const retryRoot = `${taskDir}/retry`;
mkdirSync(resolve(process.cwd(), retryRoot), { recursive: true });

// Number the attempts so the history of a repair is readable afterwards.
const attempt =
  readdirSync(resolve(process.cwd(), retryRoot))
    .map((d) => Number(d))
    .filter((n) => Number.isInteger(n))
    .reduce((max, n) => Math.max(max, n), 0) + 1;
const outdir = `${retryRoot}/${attempt}`;

const args = ["playwright", "test", spec, ...(grep ? ["-g", grep] : ["--last-failed"])];
console.log(`▸ retry #${attempt} — ${grep ? `only tests matching "${grep}"` : "only last run's failures"}\n`);

let failed = false;
try {
  execFileSync("npx", args, { stdio: "inherit", env: { ...process.env, E2E_OUTDIR: outdir } });
} catch {
  failed = true;
}

// Merge whatever the retry produced into the canonical report, so the pass/fail counts describe
// every case of the task rather than only the ones just re-run.
const abs = (p: string) => resolve(process.cwd(), p);
const canonicalPath = `${taskDir}/report.json`;
const retryPath = `${outdir}/report.json`;
let merged: Report | undefined;

if (existsSync(abs(retryPath)) && existsSync(abs(canonicalPath))) {
  const base = JSON.parse(readFileSync(abs(canonicalPath), "utf8")) as Report;
  const incoming = JSON.parse(readFileSync(abs(retryPath), "utf8")) as Report;
  merged = mergeReports(base, incoming);
  writeFileSync(abs(canonicalPath), JSON.stringify(merged, null, 2));
}

if (merged) {
  const { expected, unexpected, skipped } = merged.stats;
  console.log(
    `\n▸ toàn task sau khi gộp: ${countSpecs(merged)} case · ${expected} pass · ${unexpected} fail` +
      (skipped ? ` · ${skipped} skipped` : ""),
  );
}
console.log(`▸ HTML của lần retry này: ${outdir}/html/index.html`);
console.log(
  `▸ ${taskDir}/html/index.html vẫn là của lần chạy đầy đủ gần nhất — nó KHÔNG chứa kết quả retry.`,
);

if (failed) {
  console.log(`▸ vẫn còn fail — xem ${outdir}/html/index.html`);
  process.exit(1);
}
console.log(`▸ đã pass. Chạy đầy đủ một lần trước khi báo cáo: pnpm e2e:all ${slug}`);
