import { describe, it, expect } from "vitest";
import { mergeReports, countSpecs } from "../src/merge-report.js";

// A Playwright JSON report is a tree: suites → (suites) → specs → tests → results.
// Only the parts the merge touches are modelled here.
const spec = (id: string, title: string, ok: boolean) => ({
  id,
  title,
  file: "BR-52v3/browser/BR-52v3.spec.ts",
  line: 1,
  ok,
  tests: [{ results: [{ status: ok ? "passed" : "failed", duration: 100 }] }],
});

const report = (specs: ReturnType<typeof spec>[], stats: Record<string, number> = {}) => ({
  config: { workers: 4 },
  stats: { expected: 0, unexpected: 0, skipped: 0, flaky: 0, duration: 0, ...stats },
  suites: [{ title: "group", specs, suites: [] }],
});

describe("mergeReports", () => {
  it("keeps specs that the retry never ran", () => {
    const base = report([spec("a", "TD-01", true), spec("b", "TD-02", true), spec("c", "TD-03", false)]);
    const retry = report([spec("c", "TD-03", true)]);

    const merged = mergeReports(base, retry);

    expect(countSpecs(merged)).toBe(3);
  });

  it("lets the newer result win for a spec that was re-run", () => {
    const base = report([spec("c", "TD-03", false)]);
    const retry = report([spec("c", "TD-03", true)]);

    const merged = mergeReports(base, retry);
    const merged_c = merged.suites[0].specs.find((s) => s.id === "c");

    expect(merged_c?.ok).toBe(true);
    expect(merged_c?.tests[0].results[0].status).toBe("passed");
  });

  it("never lets a retry turn a spec it did not run into a failure", () => {
    // The bug being fixed: a retry wrote its own report over the full one, so specs
    // absent from the retry vanished from the report even though they had passed.
    const base = report([spec("a", "TD-01", true), spec("b", "TD-02", true)]);
    const retry = report([]);

    const merged = mergeReports(base, retry);

    expect(countSpecs(merged)).toBe(2);
    expect(merged.suites[0].specs.every((s) => s.ok)).toBe(true);
  });

  it("recomputes stats from the merged tree rather than copying either side's", () => {
    const base = report([spec("a", "TD-01", true), spec("c", "TD-03", false)], {
      expected: 1,
      unexpected: 1,
    });
    const retry = report([spec("c", "TD-03", true)], { expected: 1, unexpected: 0 });

    const merged = mergeReports(base, retry);

    expect(merged.stats.expected).toBe(2);
    expect(merged.stats.unexpected).toBe(0);
  });

  it("adds a spec the base never had, so a newly written case is not lost", () => {
    const base = report([spec("a", "TD-01", true)]);
    const retry = report([spec("z", "TD-99", true)]);

    const merged = mergeReports(base, retry);

    expect(countSpecs(merged)).toBe(2);
  });

  it("merges specs nested in a sub-suite, matching by id not by position", () => {
    const base = {
      config: {},
      stats: { expected: 0, unexpected: 0, skipped: 0, flaky: 0, duration: 0 },
      suites: [
        { title: "outer", specs: [], suites: [{ title: "inner", specs: [spec("n", "TD-07", false)], suites: [] }] },
      ],
    };
    const retry = {
      config: {},
      stats: { expected: 0, unexpected: 0, skipped: 0, flaky: 0, duration: 0 },
      suites: [
        { title: "outer", specs: [], suites: [{ title: "inner", specs: [spec("n", "TD-07", true)], suites: [] }] },
      ],
    };

    const merged = mergeReports(base as never, retry as never);

    expect(merged.suites[0].suites[0].specs[0].ok).toBe(true);
    expect(merged.stats.expected).toBe(1);
  });
});
