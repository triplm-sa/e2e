import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { parse } from "yaml";
import { loadConfig, resolveTarget } from "./config.js";
import { runApiStep } from "./api-runner.js";
import { renderReport, renderCsv } from "./report.js";
import { isApiStep, phaseOf } from "./types.js";
import type { CaseFile, Step, StepResult } from "./types.js";

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

/** Index every step so ids stay stable no matter which phase bucket it runs in. */
const indexed: { step: Step; index: number }[] = cf.steps.map((step, index) => ({ step, index }));
// Teardown always runs last and always runs; everything else keeps its declared order.
const main = indexed.filter(({ step }) => phaseOf(step) !== "teardown");
const teardown = indexed.filter(({ step }) => phaseOf(step) === "teardown");

async function execute({ step, index }: { step: Step; index: number }): Promise<StepResult> {
  const target = resolveTarget(cfg, step.target);
  if (isApiStep(step) && target.kind === "api") {
    const { result, captured } = await runApiStep(step, target, configDir, cf.id, index, vars);
    Object.assign(vars, captured);
    return { ...result, phase: phaseOf(step), risk: step.risk };
  }
  return {
    caseId: cf.id, case: step.case, index, target: step.target, kind: "browser", phase: phaseOf(step), risk: step.risk,
    action: (step as { action?: string }).action ?? "(browser step)",
    passed: false,
    detail: "browser step — run with `pnpm e2e:browser` (the .ts spec), then merge results; see SKILL.",
  };
}

function skip({ step, index }: { step: Step; index: number }, reason: string): StepResult {
  return {
    caseId: cf.id, case: step.case, index, target: step.target,
    kind: isApiStep(step) ? "api" : "browser", phase: phaseOf(step), risk: step.risk,
    action: (step as { action?: string }).action ?? "(step)",
    passed: false, skipped: true, detail: reason,
  };
}

/** `parallelGroup` only ever applies to `test`-phase API steps — see the field doc in types.ts. */
function groupKey(entry: { step: Step; index: number }): string | undefined {
  if (phaseOf(entry.step) !== "test") return undefined;
  return (entry.step as { parallelGroup?: string }).parallelGroup;
}

let abortedBy: string | null = null;
for (let i = 0; i < main.length; ) {
  if (abortedBy) { results.push(skip(main[i], `skipped — precondition ${abortedBy} failed`)); i++; continue; }

  const key = groupKey(main[i]);
  if (key === undefined) {
    // No opt-in: run exactly as before, one step at a time, in declared order.
    const result = await execute(main[i]);
    results.push(result);
    if (!result.passed && phaseOf(main[i].step) === "setup") abortedBy = result.case ?? `step ${result.index}`;
    i++;
    continue;
  }

  // Batch every contiguous step sharing this group name and run them concurrently.
  // Steps outside the batch still wait for it — grouping never reorders across the batch boundary.
  let j = i;
  while (j < main.length && groupKey(main[j]) === key) j++;
  const batch = main.slice(i, j);
  const batchResults = await Promise.all(batch.map(execute));
  for (const [idx, entry] of batch.entries()) {
    results.push(batchResults[idx]);
    // A setup step never carries parallelGroup (see groupKey), so this branch is unreachable for
    // this batch; kept only so the abort check reads the same as the sequential path above.
    if (!batchResults[idx].passed && phaseOf(entry.step) === "setup") abortedBy = batchResults[idx].case ?? `step ${entry.index}`;
  }
  i = j;
}
// Cleanup is best effort and must run even when the tests were aborted.
for (const t of teardown) results.push(await execute(t));

const md = renderReport(cf.feature, results);
// Output is grouped per task under reports/<slug>/ (cases/ holds inputs only). slug = the task folder name.
const slug = basename(dirname(resolve(cwd, caseArg)));
const reportDir = resolve(cwd, "reports", slug);
mkdirSync(reportDir, { recursive: true });
const out = resolve(reportDir, "report.md");
writeFileSync(out, md);
// CSV is a mechanical projection of the run — generated here so it is deterministic and free.
writeFileSync(resolve(reportDir, "report.csv"), renderCsv(results));

// Only `test` steps count towards the score; setup/teardown are machinery, not assertions.
const tests = results.filter((r) => (r.phase ?? "test") === "test");
const pass = tests.filter((r) => r.passed).length;
const skipped = tests.filter((r) => r.skipped).length;
console.log(
  `API steps: ${pass}/${tests.length} passed${skipped ? ` · ${skipped} skipped` : ""}` +
  `${abortedBy ? ` · aborted by failed setup (${abortedBy})` : ""} → ${out}`,
);
// Fail the run on any failed assertion, and on a failed setup even if no test ran.
process.exit(results.some((r) => r.kind === "api" && !r.passed && !r.skipped) ? 1 : 0);
