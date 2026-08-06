import type { StepResult } from "./types.js";

export function renderReport(feature: string, results: StepResult[], generatedAt = "N/A"): string {
  const pass = results.filter((r) => r.passed).length;
  const lines: string[] = [];
  lines.push(`# E2E Report: ${feature}`, "", `Generated at: ${generatedAt}`, "", `**Result: ${pass}/${results.length} passed**`, "");
  lines.push("| Case | Target | Scenario | Result | Detail |", "|---|---|---|---|---|");
  for (const r of results) {
    const mark = r.passed ? "✅ PASS" : "❌ FAIL";
    lines.push(`| ${r.case ?? r.index} | ${r.target} | ${escape(r.action)} | ${mark} | ${escape(r.detail)} |`);
  }
  const withErrors = results.filter((r) => r.consoleErrors?.length);
  if (withErrors.length) {
    lines.push("", "## Console errors", "");
    for (const r of withErrors) {
      lines.push(`### Step ${r.index} (${r.target})`, "```", ...(r.consoleErrors ?? []), "```", "");
    }
  }
  lines.push("", "## Analysis", "", "> (Claude fills in root-cause analysis and points to file:line here.)", "");
  return lines.join("\n");
}

function escape(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
