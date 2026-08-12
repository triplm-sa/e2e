import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildExecutionReport, mergeExecutionReports, parsePlaywrightReport } from "../src/execution-report.js";

describe("execution report", () => {
  it("merges API and browser results into one source of truth", () => {
    const api = [{ caseId: "TD-01", case: "TD-01", index: 0, target: "api", kind: "api" as const, phase: "test" as const, action: "GET /x", passed: true, detail: "ok" }];
    const browser = [{ caseId: "TD-02", case: "TD-02", index: 0, target: "browser", kind: "browser" as const, phase: "test" as const, action: "save", passed: false, detail: "failed" }];
    const report = mergeExecutionReports("Tax display", api, browser, "2026-01-01T00:00:00.000Z");
    expect(report.results.map((r) => r.case)).toEqual(["TD-01", "TD-02"]);
    expect(report.summary).toEqual({ total: 2, passed: 1, failed: 1, skipped: 0 });
  });

  it("does not count skipped results as failed", () => {
    const report = buildExecutionReport("x", [{ caseId: "x", index: 0, target: "api", kind: "api", action: "setup", passed: false, skipped: true, detail: "blocked" }]);
    expect(report.summary).toEqual({ total: 1, passed: 0, failed: 0, skipped: 1 });
  });

  it("attributes a browser result to its own test case id, not the describe block's slug", () => {
    // The describe-block title conventionally repeats the slug (e.g. "BR-55 · Finance & Payment
    // Report"), which itself matches the case-id pattern. A naive "first match in the whole title"
    // extraction picks up the slug instead of the real per-test id (e.g. "TD-01").
    const playwrightJson = {
      suites: [
        {
          title: "BR-55.spec.ts",
          file: "BR-55.spec.ts",
          suites: [
            {
              title: "BR-55 · Finance & Payment Report",
              specs: [
                {
                  title: "TD-01 · Customer group + report ON → menu Report hiện",
                  ok: true,
                  // Real Playwright JSON reporter output: the test title lives on the spec, not on the
                  // per-run `test` entry (that only carries status/results/project metadata).
                  tests: [{ status: "passed", results: [{ status: "passed", duration: 100 }] }],
                },
              ],
            },
          ],
        },
      ],
    };
    const dir = mkdtempSync(join(tmpdir(), "execution-report-test-"));
    const path = join(dir, "browser-report.json");
    writeFileSync(path, JSON.stringify(playwrightJson));

    const results = parsePlaywrightReport(path, "BR-55");
    expect(results).toHaveLength(1);
    expect(results[0].case).toBe("TD-01");
    expect(results[0].caseId).toBe("TD-01");
  });

  it("supports lettered sub-case ids like TD-02b", () => {
    const playwrightJson = {
      suites: [
        {
          title: "BR-55.spec.ts",
          file: "BR-55.spec.ts",
          suites: [
            {
              title: "BR-55 · Finance & Payment Report",
              specs: [
                {
                  title: "TD-02b · Mục Member hiện cho company admin",
                  ok: true,
                  tests: [{ status: "skipped", results: [{ status: "skipped" }] }],
                },
              ],
            },
          ],
        },
      ],
    };
    const dir = mkdtempSync(join(tmpdir(), "execution-report-test-"));
    const path = join(dir, "browser-report.json");
    writeFileSync(path, JSON.stringify(playwrightJson));

    const results = parsePlaywrightReport(path, "BR-55");
    expect(results[0].case).toBe("TD-02b");
  });
});
