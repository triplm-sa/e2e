import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { renderCsv, renderReport } from "./report.js";
import { mergeExecutionReports, parsePlaywrightReport, writeJson, type ExecutionReport } from "./execution-report.js";
import type { CaseFile } from "./types.js";

const slugs = process.argv.slice(2);
if (!slugs.length) { console.error("Usage: pnpm e2e:all <slug> [<slug> ...]"); process.exit(1); }

function run(cmd: string, args: string[], env: Record<string, string> = {}): boolean {
  try { execFileSync(cmd, args, { stdio: "inherit", env: { ...process.env, ...env } }); return true; }
  catch { return false; }
}

function selectedTargets(): string[] {
  const found = new Set<string>();
  for (const slug of slugs) {
    const yamlPath = resolve(process.cwd(), `cases/${slug}/cases.yaml`);
    const specPath = resolve(process.cwd(), `cases/${slug}/browser/${slug}.spec.ts`);
    if (existsSync(yamlPath)) {
      try {
        for (const target of ((parse(readFileSync(yamlPath, "utf8")) as Partial<CaseFile>).targets ?? [])) found.add(target);
      } catch { /* the run will report the actual validation error */ }
    }
    if (existsSync(specPath)) {
      const text = readFileSync(specPath, "utf8");
      for (const match of text.matchAll(/openTarget\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) found.add(match[1]);
    }
  }
  return [...found];
}

const targets = selectedTargets();
console.log("\n########## doctor ##########");
const doctorEnv = targets.length ? { E2E_DOCTOR_TARGETS: targets.join(",") } : {};
if (!run("tsx", ["src/doctor.ts"], doctorEnv)) {
  console.error("❌ Preflight failed. No E2E task was executed.");
  process.exit(1);
}

let anyFail = false;
for (const slug of slugs) {
  console.log(`\n########## ${slug} ##########`);
  const root = process.cwd();
  const yamlPath = resolve(root, `cases/${slug}/cases.yaml`);
  const spec = resolve(root, `cases/${slug}/browser/${slug}.spec.ts`);
  const outdir = resolve(root, `reports/${slug}`);
  const apiReportPath = resolve(outdir, "api-report.json");
  const browserReportPath = resolve(outdir, "browser-report.json");
  const hasApi = existsSync(yamlPath);
  const hasBrowser = existsSync(spec);

  if (!hasApi && !hasBrowser) {
    console.error(`❌ ${slug}: no runnable artifact found (expected ${yamlPath} and/or ${spec})`);
    anyFail = true;
    continue;
  }
  mkdirSync(outdir, { recursive: true });

  if (hasApi) {
    console.log(`\n--- ${slug}: API ---`);
    if (!run("tsx", ["src/run.ts", yamlPath])) anyFail = true;
  }
  if (hasBrowser) {
    console.log(`\n--- ${slug}: browser ---`);
    if (!run("npx", ["playwright", "test", spec], { E2E_OUTDIR: outdir })) anyFail = true;
    const playwrightJson = resolve(outdir, "report.json");
    if (existsSync(playwrightJson)) writeFileSync(browserReportPath, readFileSync(playwrightJson));
    else { console.error(`❌ ${slug}: browser run completed without ${playwrightJson}`); anyFail = true; }
  }

  let feature = slug;
  let apiResults = [] as ExecutionReport["results"];
  if (existsSync(apiReportPath)) {
    const api = JSON.parse(readFileSync(apiReportPath, "utf8")) as ExecutionReport;
    feature = api.feature || feature;
    apiResults = api.results;
  } else if (hasApi) {
    try { feature = (parse(readFileSync(yamlPath, "utf8")) as CaseFile).feature || feature; } catch { /* validation error already surfaced */ }
  }
  const browserResults = existsSync(browserReportPath) ? parsePlaywrightReport(browserReportPath, slug) : [];
  const merged = mergeExecutionReports(feature, apiResults, browserResults);
  writeJson(resolve(outdir, "report.json"), merged);
  writeFileSync(resolve(outdir, "report.generated.md"), renderReport(feature, merged.results));
  writeFileSync(resolve(outdir, "report.csv"), renderCsv(merged.results));

  const humanReport = resolve(outdir, "report.md");
  if (!existsSync(humanReport)) writeFileSync(humanReport, renderReport(feature, merged.results));
  console.log(`>>> ${slug}: canonical report → ${outdir}/report.json`);
}

process.exit(anyFail ? 1 : 0);
