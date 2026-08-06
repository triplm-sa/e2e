import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { parse } from "yaml";
import { loadConfig, resolveTarget } from "./config.js";
import { runApiStep } from "./api-runner.js";
import { renderReport } from "./report.js";
import { isApiStep } from "./types.js";
import type { CaseFile, StepResult } from "./types.js";

// Usage: pnpm e2e:run cases/tax-display.yaml
const caseArg = process.argv[2];
if (!caseArg) { console.error("Usage: e2e:run <case.yaml>"); process.exit(1); }

const cwd = process.cwd();
const configPath = resolve(cwd, process.env.E2E_CONFIG ?? "e2e.config.yaml");
const configDir = dirname(configPath);
const cfg = loadConfig(configPath);
const cf = parse(readFileSync(resolve(cwd, caseArg), "utf8")) as CaseFile;

const results: StepResult[] = [];
// Variables chained across API steps (captured in an earlier step → `${var}` in a later step).
const vars: Record<string, unknown> = {};
for (let i = 0; i < cf.steps.length; i++) {
  const step = cf.steps[i];
  const target = resolveTarget(cfg, step.target);
  if (isApiStep(step) && target.kind === "api") {
    const { result, captured } = await runApiStep(step, target, configDir, cf.id, i, vars);
    Object.assign(vars, captured);
    results.push(result);
  } else {
    results.push({
      caseId: cf.id, case: (step as { case?: string }).case, index: i, target: step.target, kind: "browser",
      action: (step as { action?: string }).action ?? "(browser step)",
      passed: false,
      detail: "browser step — run with `pnpm e2e:browser` (the .ts spec), then merge results; see SKILL.",
    });
  }
}

const md = renderReport(cf.feature, results);
// Output is grouped per task under reports/<slug>/ (cases/ holds inputs only). slug = the task folder name.
const slug = basename(dirname(resolve(cwd, caseArg)));
const reportDir = resolve(cwd, "reports", slug);
mkdirSync(reportDir, { recursive: true });
const out = resolve(reportDir, "report.md");
writeFileSync(out, md);
const pass = results.filter((r) => r.passed).length;
console.log(`API steps: ${pass}/${results.length} passed → ${out}`);
process.exit(results.some((r) => !r.passed && r.kind === "api") ? 1 : 0);
