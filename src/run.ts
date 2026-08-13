import { readFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { parse } from "yaml";
import { loadConfig, resolveTarget } from "./config.js";
import { runApiStep } from "./api-runner.js";
import { buildExecutionReport, writeJson } from "./execution-report.js";
import { isApiStep, phaseOf } from "./types.js";
import { validateCaseFile } from "./validation.js";
import type { CaseFile, Step, StepResult } from "./types.js";

const caseArg = process.argv[2];
if (!caseArg) { console.error("Usage: e2e:run <case.yaml>"); process.exit(1); }

const cwd = process.cwd();
const casePath = resolve(cwd, caseArg);
const configPath = resolve(cwd, process.env.E2E_CONFIG ?? "e2e.config.yaml");
const configDir = dirname(configPath);
const cfg = loadConfig(configPath);
const cf: CaseFile = validateCaseFile(parse(readFileSync(casePath, "utf8")));

const results: StepResult[] = [];
const vars: Record<string, unknown> = {};
const indexed = cf.steps.map((step, index) => ({ step, index }));
const setup = indexed.filter(({ step }) => phaseOf(step) === "setup");
const tests = indexed.filter(({ step }) => phaseOf(step) === "test");
const teardown = indexed.filter(({ step }) => phaseOf(step) === "teardown");

async function execute({ step, index }: { step: Step; index: number }): Promise<StepResult> {
  const target = resolveTarget(cfg, step.target);
  if (!isApiStep(step)) throw new Error(`browser step ${step.case ?? index} belongs in Playwright, not src/run.ts`);
  if (target.kind !== "api") throw new Error(`API step ${step.case ?? index} targets '${step.target}', whose kind is '${target.kind}'`);
  const { result, captured } = await runApiStep(step, target, configDir, cf.id, index, vars);
  Object.assign(vars, captured);
  return { ...result, phase: phaseOf(step), risk: step.risk };
}

function skip({ step, index }: { step: Step; index: number }, reason: string): StepResult {
  return { caseId: cf.id, case: step.case, index, target: step.target, kind: isApiStep(step) ? "api" : "browser", phase: phaseOf(step), risk: step.risk, action: isApiStep(step) ? step.action ?? `${step.request.method} ${step.request.path}` : step.action, passed: false, skipped: true, detail: reason };
}

function configFailure({ step, index }: { step: Step; index: number }, err: unknown): StepResult {
  return { caseId: cf.id, case: step.case, index, target: step.target, kind: isApiStep(step) ? "api" : "browser", phase: phaseOf(step), risk: step.risk, action: isApiStep(step) ? step.action ?? `${step.request.method} ${step.request.path}` : step.action, passed: false, failureType: "configuration", detail: `configuration error: ${(err as Error).message}` };
}

let abortedBy: string | null = null;
for (const item of setup) {
  if (abortedBy) { results.push(skip(item, `skipped — precondition ${abortedBy} failed`)); continue; }
  let result: StepResult;
  try { result = await execute(item); } catch (err) { result = configFailure(item, err); }
  results.push(result);
  if (!result.passed) abortedBy = result.case ?? `step ${result.index}`;
}
for (const item of tests) {
  if (abortedBy) { results.push(skip(item, `skipped — precondition ${abortedBy} failed`)); continue; }
  try { results.push(await execute(item)); } catch (err) { results.push(configFailure(item, err)); }
}
for (const item of teardown) {
  try {
    results.push(await execute(item));
  } catch (err) {
    const failure = configFailure(item, err);
    results.push({ ...failure, failureType: "teardown", phase: "teardown" });
  }
}

const slug = basename(dirname(casePath));
const reportDir = resolve(cwd, "reports", slug);
mkdirSync(reportDir, { recursive: true });
const report = buildExecutionReport(cf.feature, results);
writeJson(resolve(reportDir, "api-report.json"), report);

const failed = results.some((r) => !r.passed && !r.skipped);
const testResults = results.filter((r) => phaseOf(r) === "test");
console.log(`API steps: ${testResults.filter((r) => r.passed).length}/${testResults.length} passed` + `${results.some((r) => r.skipped) ? ` · ${results.filter((r) => r.skipped).length} skipped` : ""}` + `${abortedBy ? ` · aborted by failed setup (${abortedBy})` : ""} → ${reportDir}/api-report.json`);
process.exit(failed ? 1 : 0);
