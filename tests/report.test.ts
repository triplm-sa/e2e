import { describe, it, expect } from "vitest";
import { renderReport, renderCsv } from "../src/report.js";
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

  it("scores only test steps, leaving setup and teardown out of the total", () => {
    const md = renderReport("Orders", [
      { caseId: "T", index: 0, target: "api", kind: "api", phase: "setup", action: "create order", passed: true, detail: "ok" },
      { caseId: "T", index: 1, target: "api", kind: "api", action: "report total", passed: true, detail: "ok" },
      { caseId: "T", index: 2, target: "api", kind: "api", phase: "teardown", action: "cancel order", passed: true, detail: "ok" },
    ]);
    expect(md).toContain("**Result: 1/1 passed**");
  });

  it("reports steps skipped after a failed setup as skipped, and warns it is not a feature defect", () => {
    const md = renderReport("Orders", [
      { caseId: "T", index: 0, target: "api", kind: "api", phase: "setup", action: "create order", passed: false, detail: "status 500" },
      { caseId: "T", index: 1, target: "api", kind: "api", action: "report total", passed: false, skipped: true, detail: "skipped — precondition SETUP-01 failed" },
    ]);
    expect(md).toContain("**Result: 0/1 passed** · 1 skipped");
    expect(md).toContain("⏭️ SKIP");
    expect(md).toMatch(/Setup thất bại/);
    expect(md).toMatch(/không phải feature sai/);
  });
});

describe("renderCsv", () => {
  it("emits a header plus one row per step, with the run's own facts filled in", () => {
    const csv = renderCsv([
      { caseId: "T", index: 0, target: "api", kind: "api", risk: "High", action: "check total", passed: true, detail: "ok" },
    ]);
    const [header, row] = csv.trimEnd().split("\n");
    expect(header).toBe("TC ID,Phase,Target,Risk,Status,Scenario,Detail,Type");
    // The step declared no case id, so the index is used. Type is left blank on purpose:
    // classifying a failure is a judgement, not something the runner can infer.
    expect(row).toBe("0,test,api,High,PASSED,check total,ok,");
  });

  it("uses the case id when present and reports skipped steps distinctly", () => {
    const csv = renderCsv([
      { caseId: "T", case: "TD-01", index: 0, target: "cms", kind: "browser", phase: "setup", action: "seed", passed: false, detail: "boom" },
      { caseId: "T", case: "TD-02", index: 1, target: "cms", kind: "browser", action: "assert", passed: false, skipped: true, detail: "skipped" },
    ]);
    expect(csv).toContain("TD-01,setup,cms,,FAILED,seed,boom,");
    expect(csv).toContain("TD-02,test,cms,,SKIPPED,assert,skipped,");
  });

  it("quotes fields containing a comma, quote or newline (RFC 4180)", () => {
    const csv = renderCsv([
      { caseId: "T", case: "TD-03", index: 0, target: "api", kind: "api", action: 'a,b "q"', passed: false, detail: "line1\nline2" },
    ]);
    expect(csv).toContain('"a,b ""q"""');
    expect(csv).toContain('"line1\nline2"');
  });
});
