import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { StepResult } from "./types.js";

export interface ExecutionReport {
  version: 1;
  feature: string;
  generatedAt: string;
  results: StepResult[];
  summary: { total: number; passed: number; failed: number; skipped: number };
}

export function buildExecutionReport(feature: string, results: StepResult[], generatedAt = new Date().toISOString()): ExecutionReport {
  const skipped = results.filter((r) => r.skipped).length;
  const passed = results.filter((r) => r.passed).length;
  return {
    version: 1,
    feature,
    generatedAt,
    results,
    summary: { total: results.length, passed, failed: results.length - passed - skipped, skipped },
  };
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

interface PlaywrightJson { suites?: PlaywrightSuite[] }
interface PlaywrightSuite { title?: string; file?: string; specs?: PlaywrightSpec[]; suites?: PlaywrightSuite[] }
interface PlaywrightSpec { title?: string; ok?: boolean; tests?: PlaywrightTest[] }
interface PlaywrightTest { title?: string; status?: string; results?: PlaywrightTestResult[] }
interface PlaywrightTestResult {
  status?: string;
  duration?: number;
  error?: { message?: string; stack?: string };
  errors?: { message?: string; stack?: string }[];
  attachments?: { name?: string; path?: string }[];
}

function collectSpecs(suites: PlaywrightSuite[] = [], parentTitle = ""):
  Array<{ title: string; file?: string; spec: PlaywrightSpec }> {
  const out: Array<{ title: string; file?: string; spec: PlaywrightSpec }> = [];
  for (const suite of suites) {
    const title = [parentTitle, suite.title].filter(Boolean).join(" ").trim();
    for (const spec of suite.specs ?? []) out.push({ title: [title, spec.title].filter(Boolean).join(" ").trim(), file: suite.file, spec });
    out.push(...collectSpecs(suite.suites, title));
  }
  return out;
}

function extractCaseId(title: string, fallback: string): string {
  // Trailing letter suffix (e.g. "TD-02b") covers lettered sub-case ids; still requires a \b after so a
  // longer alphanumeric tail (e.g. "TD-02banana") is not mistaken for one.
  return title.match(/\b[A-Z][A-Z0-9_]*-\d+[a-z]?\b/)?.[0] ?? fallback;
}

export function parsePlaywrightReport(path: string, defaultCaseId = "BROWSER"): StepResult[] {
  if (!existsSync(path)) return [];
  const data = JSON.parse(readFileSync(path, "utf8")) as PlaywrightJson;
  const results: StepResult[] = [];
  let index = 0;
  for (const { title, file, spec } of collectSpecs(data.suites)) {
    for (const test of spec.tests ?? []) {
      const last = test.results?.at(-1);
      const status = last?.status ?? test.status ?? (spec.ok ? "passed" : "failed");
      const passed = status === "passed";
      const skipped = status === "skipped" || status === "pending";
      const errors = [last?.error, ...(last?.errors ?? [])].filter(Boolean)
        .map((e) => e?.message || e?.stack || "browser test failed") as string[];
      const screenshot = (last?.attachments ?? []).find((a) => a.name?.startsWith("screenshot-"))?.path;
      const action = [title, test.title].filter(Boolean).join(" — ") || file || "browser test";
      // Prefer the ID in the spec's own title first — `title` here already includes every ancestor
      // suite title (see collectSpecs), and the describe-block conventionally repeats the slug (e.g.
      // "BR-55 · Finance & Payment Report"). That slug also matches the ID pattern and, being leftmost,
      // would otherwise be picked up instead of the real per-test case id (e.g. "TD-01").
      const caseId = extractCaseId(spec.title ?? "", "") || extractCaseId(action, defaultCaseId);
      results.push({
        caseId, case: caseId, index,
        target: "browser", kind: "browser", phase: "test", action, passed, skipped,
        detail: passed ? `Playwright passed${last?.duration ? ` in ${last.duration}ms` : ""}` : errors.join("; ") || `Playwright status: ${status}`,
        consoleErrors: [], ...(screenshot ? { screenshot } : {}),
      });
      index++;
    }
  }
  return results;
}

export function mergeExecutionReports(feature: string, apiResults: StepResult[], browserResults: StepResult[], generatedAt = new Date().toISOString()): ExecutionReport {
  return buildExecutionReport(feature, [...apiResults, ...browserResults], generatedAt);
}
