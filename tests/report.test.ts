import { describe, it, expect } from "vitest";
import { renderReport } from "../src/report.js";
import type { StepResult } from "../src/types.js";

const results: StepResult[] = [
  { caseId: "T1", index: 0, target: "api", kind: "api", action: "POST /rules", passed: true, detail: "status 200 ok" },
  { caseId: "T1", index: 1, target: "cms", kind: "browser", action: "open the rules page", passed: false, detail: "assert failed", consoleErrors: ["[pageerror] x is not defined"] },
];

describe("renderReport", () => {
  it("includes the feature heading, the pass/fail table and console errors", () => {
    const md = renderReport("Tax Display", results);
    expect(md).toMatch(/# E2E Report: Tax Display/);
    expect(md).toMatch(/1\/2 passed|PASS.*FAIL/s);
    expect(md).toContain("x is not defined");
    expect(md).toMatch(/❌|FAIL/);
  });
});
