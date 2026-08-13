import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { renderReport, renderCsv, renderHtmlReport, buildExecutionReport, mergeExecutionReports, parsePlaywrightReport, type ExecutionReport } from "../src/report.js";
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

  it("shows the case's actual input/output in the table instead of a generic status line", () => {
    const md = renderReport("Orders", [
      { caseId: "T", case: "TD-20", index: 0, target: "api", kind: "api", action: "check total", passed: true, detail: "status 200 + 1 bodyMatch ok", input: "GET /orders/1", output: 'status=200, total=299' },
      { caseId: "T", case: "TD-21", index: 1, target: "api", kind: "api", action: "no io captured", passed: true, detail: "ok" },
    ]);
    expect(md).toContain("| Input | Output |");
    expect(md).toContain("GET /orders/1");
    expect(md).toContain("total=299");
    expect(md).toMatch(/no io captured \| — \| — \|/);
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

  it("quotes fields containing a comma or quote (RFC 4180)", () => {
    const csv = renderCsv([
      { caseId: "T", case: "TD-03", index: 0, target: "api", kind: "api", action: 'a,b "q"', passed: false, detail: "detail" },
    ]);
    expect(csv).toContain('"a,b ""q"""');
  });

  it("collapses embedded newlines and strips ANSI codes so no row ever spans multiple lines", () => {
    const csv = renderCsv([
      {
        caseId: "T", case: "TD-04", index: 0, target: "browser", kind: "browser", passed: false,
        action: "assert",
        detail: "Error: \x1b[2mexpect\x1b[22m failed\n\nCall log:\n  - waiting for locator",
      },
    ]);
    expect(csv.split("\n")).toHaveLength(3); // header + 1 data row + trailing newline
    expect(csv).not.toMatch(/\x1b/);
    expect(csv).toContain("Error: expect failed Call log:   - waiting for locator");
  });
});

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

function report(results: ExecutionReport["results"]): ExecutionReport {
  const passed = results.filter((r) => r.passed).length;
  const skipped = results.filter((r) => r.skipped).length;
  return { version: 1, feature: "Demo", generatedAt: "2026-01-01T00:00:00.000Z", results, summary: { total: results.length, passed, failed: results.length - passed - skipped, skipped } };
}

describe("renderHtmlReport", () => {
  it("produces one self-contained document: no external stylesheet, script or image reference", () => {
    const html = renderHtmlReport(report([{ caseId: "T", case: "TD-01", index: 0, target: "api", kind: "api", action: "open", passed: true, detail: "ok" }]), "## Bug\n\nKhông phát hiện bug.");
    expect(html).toContain("<style>");
    expect(html).not.toMatch(/<link[^>]+href=/);
    expect(html).not.toMatch(/src=["'](https?:)?\/\//);
    expect(html).toContain("<title>E2E Report — Demo</title>");
  });

  it("embeds a failed case's screenshot as a data URI, never a bare file path", () => {
    const html = renderHtmlReport(
      report([{ caseId: "T", case: "TD-04", index: 0, target: "browser", kind: "browser", action: "open", passed: false, detail: "assertion failed", screenshot: "data:image/png;base64,QUJD" }]),
      "## Bug\n\nKhông phát hiện bug.",
    );
    expect(html).toContain('src="data:image/png;base64,QUJD"');
  });

  it("never embeds a screenshot for a passing case, keeping the file small", () => {
    const html = renderHtmlReport(
      report([{ caseId: "T", case: "TD-01", index: 0, target: "browser", kind: "browser", action: "open", passed: true, detail: "ok", screenshot: "data:image/png;base64,SHOULDNOTAPPEAR" }]),
      "## Bug\n\nKhông phát hiện bug.",
    );
    expect(html).not.toContain("SHOULDNOTAPPEAR");
  });

  it("escapes HTML in case data and in the analysis markdown — no raw tag injection", () => {
    const html = renderHtmlReport(
      report([{ caseId: "T", case: "TD-01", index: 0, target: "api", kind: "api", action: "open", passed: false, detail: "<script>alert(1)</script>" }]),
      "## Bug\n\n<img onerror=alert(1)>",
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img onerror=alert(1)>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("converts the fixed markdown subset used by the report skill: headings, blockquote, bullets, bold, code", () => {
    const md = [
      "## 1. Bug",
      "",
      "> **[GAP-BRS-1] Something wrong** (TD-04, AC-9) — 🟠 CÒN LẶP LẠI.",
      "> - detail one",
      "> - detail two, with `code` and **bold**",
    ].join("\n");
    const html = renderHtmlReport(report([]), md);
    expect(html).toContain("<h3>1. Bug</h3>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<strong>[GAP-BRS-1] Something wrong</strong>");
    expect(html).toContain("<li>detail one</li>");
    expect(html).toContain("<code>code</code>");
  });

  it("shows the case's actual input/output in the HTML table instead of a generic status line", () => {
    const html = renderHtmlReport(
      report([{ caseId: "T", case: "TD-20", index: 0, target: "api", kind: "api", action: "check total", passed: true, detail: "status 200 + 1 bodyMatch ok", input: "GET /orders/1", output: "status=200, total=299" }]),
      "## Bug\n\nKhông phát hiện bug.",
    );
    expect(html).toContain("<th>Input</th><th>Output</th>");
    expect(html).toContain("GET /orders/1");
    expect(html).toContain("total=299");
  });

  it("lists skipped cases and non-noise console errors as their own sections", () => {
    const html = renderHtmlReport(
      report([
        { caseId: "T", case: "TD-27", index: 0, target: "browser", kind: "browser", action: "open", passed: false, skipped: true, detail: "no matching data" },
        { caseId: "T", case: "TD-01", index: 1, target: "browser", kind: "browser", action: "open", passed: true, detail: "ok", consoleErrors: ["[console.error] real bug", "[console.error] NOISE third-party"] },
      ]),
      "## Bug\n\nKhông phát hiện bug.",
    );
    expect(html).toContain("Case chưa kiểm được");
    expect(html).toContain("TD-27");
    expect(html).toContain("Console đáng chú ý");
    expect(html).toContain("real bug");
    expect(html).not.toContain("NOISE third-party");
  });
});
