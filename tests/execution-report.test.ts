import { describe, expect, it } from "vitest";
import { buildExecutionReport, mergeExecutionReports } from "../src/execution-report.js";

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
});
