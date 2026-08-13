import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { phaseOf } from "./types.js";
import type { StepResult } from "./types.js";

// ---------------------------------------------------------------------------
// Execution report: the canonical result of a run (report.json) and the
// Playwright JSON → StepResult[] parser that feeds it.
// ---------------------------------------------------------------------------

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
  attachments?: { name?: string; path?: string; body?: string; contentType?: string }[];
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

/**
 * Playwright error messages carry ANSI colour codes and a multi-line "Call log" trace meant for a
 * terminal. Reduced to one clean line here — at the source — so every downstream consumer
 * (report.html's case table, report.csv) gets a single-line detail and never has to re-sanitise raw
 * Playwright output itself.
 */
function summariseError(raw: string): string {
  const firstLine = raw
    .replace(/\x1b\[[0-9;]*m/g, "") // ANSI colour codes
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean) ?? raw;
  return firstLine;
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
        .map((e) => summariseError(e?.message || e?.stack || "browser test failed")) as string[];
      // Playwright's JSON reporter inlines small attachments as base64 (`body`), not a file `path` —
      // convert straight to a data URI so the final HTML report can embed it with no external file.
      const shot = (last?.attachments ?? []).find((a) => a.name?.startsWith("screenshot-") && a.body);
      const screenshot = shot ? `data:${shot.contentType ?? "image/png"};base64,${shot.body}` : undefined;
      // Optional: a spec that called `recordIO()` (see browser-fixture.ts) attaches plain-text
      // "input"/"output" the same way — decode straight back to text.
      const attachText = (name: string) => {
        const a = (last?.attachments ?? []).find((x) => x.name === name && x.body);
        return a ? Buffer.from(a.body!, "base64").toString("utf8") : undefined;
      };
      const input = attachText("input");
      const output = attachText("output");
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
        consoleErrors: [], ...(screenshot ? { screenshot } : {}), ...(input ? { input } : {}), ...(output ? { output } : {}),
      });
      index++;
    }
  }
  return results;
}

export function mergeExecutionReports(feature: string, apiResults: StepResult[], browserResults: StepResult[], generatedAt = new Date().toISOString()): ExecutionReport {
  return buildExecutionReport(feature, [...apiResults, ...browserResults], generatedAt);
}

// ---------------------------------------------------------------------------
// Markdown skeleton (report.generated.md) and CSV export — both mechanical
// projections of the run, kept deterministic and free of Claude prose.
// ---------------------------------------------------------------------------

export function renderReport(feature: string, results: StepResult[], generatedAt = "N/A"): string {
  // Only `test` steps are scored; setup/teardown are machinery for preparing and cleaning data.
  const tests = results.filter((r) => phaseOf(r) === "test");
  const pass = tests.filter((r) => r.passed).length;
  const skipped = tests.filter((r) => r.skipped).length;
  const failedSetup = results.filter((r) => phaseOf(r) === "setup" && !r.passed && !r.skipped);

  const lines: string[] = [];
  lines.push(`# E2E Report: ${feature}`, "", `Generated at: ${generatedAt}`, "");
  lines.push(
    `**Result: ${pass}/${tests.length} passed**` + (skipped ? ` · ${skipped} skipped` : ""),
    "",
  );

  if (failedSetup.length) {
    const names = failedSetup.map((r) => r.case ?? `step ${r.index}`).join(", ");
    lines.push(
      `> ⚠️ Setup thất bại (${names}) — các case phía sau **chưa được kiểm**, không phải feature sai.`,
      "",
    );
  }

  // Bugs come first: that is what the tester acts on. The runner cannot judge what is a defect,
  // so it leaves a slot with the required shape rather than a vague "analysis" heading.
  lines.push(
    "## 1. Bug",
    "",
    "> Claude điền mục này. Mỗi bug một khối, theo đúng mẫu dưới; không có bug thì ghi “Không phát hiện bug”.",
    "> Trạng thái: 🔴 MỚI · 🟢 ĐÃ FIX (verify lại lần này) · 🟠 CÒN LẶP LẠI (fix chưa dứt điểm).",
    ">",
    "> ### 🔴 BUG-01 · \\<tiêu đề ngắn\\> — case TD-xx · rủi ro Cao",
    "> - **Hiện tượng:** quan sát được gì trên màn hình / response",
    "> - **Kỳ vọng (AC-x):** đúng ra phải thế nào",
    "> - **Tái hiện:** các bước đánh số để tester tự làm lại bằng tay",
    "> - **Bằng chứng:** ảnh trong `artifacts/`, trace nếu có",
    "> - **Nghi ngờ nguyên nhân:** `file:line`",
    "",
    "## 2. Kết quả theo case",
    "",
  );

  lines.push("| Case | Phase | Risk | Target | Scenario | Input | Output | Result | Detail |", "|---|---|---|---|---|---|---|---|---|");
  for (const r of results) {
    const mark = r.skipped ? "⏭️ SKIP" : r.passed ? "✅ PASS" : "❌ FAIL";
    lines.push(
      `| ${r.case ?? r.index} | ${phaseOf(r)} | ${r.risk ?? "—"} | ${r.target} | ${escape(r.action)} | ${escape(r.input ?? "—")} | ${escape(r.output ?? "—")} | ${mark} | ${escape(r.detail)} |`,
    );
  }

  const notVerified = results.filter((r) => r.skipped);
  if (notVerified.length) {
    lines.push("", "## 3. Case chưa kiểm được", "");
    for (const r of notVerified) {
      lines.push(`- **${r.case ?? r.index}** — ${escape(r.action)}: ${escape(r.detail)}`);
    }
  }

  // Only messages the fixture did not tag as NOISE say anything about the application.
  const withErrors = results.filter((r) => r.consoleErrors?.some((e) => !e.includes("NOISE")));
  if (withErrors.length) {
    lines.push("", "## 4. Console đáng chú ý", "");
    for (const r of withErrors) {
      const real = (r.consoleErrors ?? []).filter((e) => !e.includes("NOISE"));
      lines.push(`### ${r.case ?? `Step ${r.index}`} (${r.target})`, "```", ...real, "```", "");
    }
  }

  return lines.join("\n");
}

function escape(s: string): string {
  return sanitizeDetail(s).replace(/\|/g, "\\|");
}

/**
 * Guarantees a single clean line regardless of source: strips ANSI colour codes and collapses any
 * embedded newline. `detail` is meant to carry a one-line summary already (see `summariseError`
 * above), but this is the last line of defence — nothing that reaches report.html or report.csv
 * should ever carry a raw multi-line stack/log trace.
 */
function sanitizeDetail(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "").replace(/[\r\n]+/g, " ").trim();
}

/**
 * Machine-readable export for Google Sheets / Jira / TestRail.
 *
 * Generated by the engine rather than written by hand: it is a mechanical projection of the run,
 * so producing it here keeps it deterministic, identically formatted every time, and free.
 * `Type` (feature / spec / flaky) is deliberately left blank — that is a judgement made while
 * analysing the failures, not something the runner can infer.
 */
export function renderCsv(results: StepResult[]): string {
  const header = ["TC ID", "Phase", "Target", "Risk", "Status", "Scenario", "Detail", "Type"];
  const rows = results.map((r) => [
    r.case ?? String(r.index),
    phaseOf(r),
    r.target,
    r.risk ?? "",
    r.skipped ? "SKIPPED" : r.passed ? "PASSED" : "FAILED",
    sanitizeDetail(r.action),
    sanitizeDetail(r.detail),
    "",
  ]);
  return [header, ...rows].map((cols) => cols.map(csvCell).join(",")).join("\n") + "\n";
}

/** Quote a CSV field only when needed, doubling any embedded quote (RFC 4180). */
function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// ---------------------------------------------------------------------------
// Final human-facing report.html: engine-generated case table (with an
// embedded screenshot for every failed case that has one) plus the tester's
// own analysis markdown, all folded into one self-contained page.
// ---------------------------------------------------------------------------

/**
 * Turns the tester-written analysis (bug findings, spec/infra classification, coverage summary —
 * whatever headings the tester chose) plus the engine's own execution truth into ONE self-contained
 * HTML file: no external stylesheet, no external image, no link that only makes sense inside this
 * repo. That is the whole point of `report.html` over the old `report.md` — a person can open it
 * anywhere and see everything, screenshots included.
 *
 * Markdown support is intentionally a small, fixed subset (headings, blockquotes, bullet lists,
 * **bold**, `code`, [text](url)) — exactly what the e2e-report skill's own prose uses. It is not a
 * general markdown engine; do not grow it to handle syntax nothing here produces.
 */
export function renderHtmlReport(report: ExecutionReport, analysisMd: string): string {
  const { feature, generatedAt, results } = report;
  const tests = results.filter((r) => phaseOf(r) === "test");
  const pass = tests.filter((r) => r.passed).length;
  const skipped = tests.filter((r) => r.skipped).length;
  const failed = tests.length - pass - skipped;

  const hero = `<header class="hero">` +
    `<h1>${escapeHtml(feature)}</h1>` +
    `<p class="meta">E2E Report · Generated at ${escapeHtml(generatedAt)}</p>` +
    `<div class="stats">` +
    `<span class="stat pass">${pass} passed</span>` +
    (failed ? `<span class="stat fail">${failed} failed</span>` : "") +
    (skipped ? `<span class="stat skip">${skipped} skipped</span>` : "") +
    `<span class="stat total">${tests.length} total</span>` +
    `</div></header>`;

  const body = [
    hero,
    `<section class="analysis">${mdToHtml(analysisMd)}</section>`,
    renderCaseTable(results),
    renderSkippedSection(results),
    renderConsoleSection(results),
  ].join("\n");

  return `<!doctype html>\n<html lang="vi"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>E2E Report — ${escapeHtml(feature)}</title>` +
    `<style>${CSS}</style></head><body><main>${body}</main></body></html>\n`;
}

function renderCaseTable(results: StepResult[]): string {
  const rows = results.map((r) => {
    const mark = r.skipped ? '<span class="badge skip">SKIP</span>' : r.passed ? '<span class="badge pass">PASS</span>' : '<span class="badge fail">FAIL</span>';
    const shot = !r.passed && !r.skipped && r.screenshot
      ? `<details><summary>Ảnh chụp</summary><img src="${r.screenshot}" alt="screenshot ${escapeHtml(r.case ?? String(r.index))}"></details>`
      : "";
    const rowClass = r.skipped ? "row-skip" : r.passed ? "" : "row-fail";
    return `<tr class="${rowClass}"><td><strong>${escapeHtml(r.case ?? String(r.index))}</strong></td><td>${escapeHtml(phaseOf(r))}</td>` +
      `<td>${escapeHtml(r.risk ?? "—")}</td><td>${escapeHtml(r.target)}</td>` +
      `<td>${escapeHtml(r.action)}</td>` +
      `<td class="io">${escapeHtml(r.input ?? "—")}</td><td class="io">${escapeHtml(r.output ?? "—")}</td>` +
      `<td>${mark}</td>` +
      `<td>${escapeHtml(r.detail)}${shot}</td></tr>`;
  });
  return `<section class="case-table"><h2>Kết quả theo case</h2><div class="table-wrap"><table>` +
    `<thead><tr><th>Case</th><th>Phase</th><th>Risk</th><th>Target</th><th>Scenario</th><th>Input</th><th>Output</th><th>Result</th><th>Detail</th></tr></thead>` +
    `<tbody>${rows.join("")}</tbody></table></div></section>`;
}

function renderSkippedSection(results: StepResult[]): string {
  const notVerified = results.filter((r) => r.skipped);
  if (!notVerified.length) return "";
  const items = notVerified.map((r) => `<li><strong>${escapeHtml(r.case ?? String(r.index))}</strong> — ${escapeHtml(r.action)}: ${escapeHtml(r.detail)}</li>`);
  return `<section><h2>Case chưa kiểm được</h2><ul>${items.join("")}</ul></section>`;
}

function renderConsoleSection(results: StepResult[]): string {
  const withErrors = results.filter((r) => r.consoleErrors?.some((e) => !e.includes("NOISE")));
  if (!withErrors.length) return "";
  const blocks = withErrors.map((r) => {
    const real = (r.consoleErrors ?? []).filter((e) => !e.includes("NOISE"));
    return `<h3>${escapeHtml(r.case ?? `Step ${r.index}`)} (${escapeHtml(r.target)})</h3><pre>${escapeHtml(real.join("\n"))}</pre>`;
  });
  return `<section><h2>Console đáng chú ý</h2>${blocks.join("")}</section>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Bold, inline code and links inside a single already-escaped line of text. */
function inline(s: string): string {
  let out = escapeHtml(s);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, href) => `<a href="${href}">${text}</a>`);
  return out;
}

/** Minimal markdown → HTML for the fixed subset the e2e-report skill's own prose uses. */
function mdToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) { out.push(`<h${heading[1].length + 1}>${inline(heading[2])}</h${heading[1].length + 1}>`); i++; continue; }
    if (line.startsWith(">")) {
      const block: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) { block.push(lines[i].replace(/^>\s?/, "")); i++; }
      out.push(`<blockquote>${mdToHtml(block.join("\n"))}</blockquote>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, "")); i++; }
      out.push(`<ul>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</ul>`);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith(">") && !/^\s*[-*]\s+/.test(lines[i]) && !/^#{1,4}\s/.test(lines[i])) { para.push(lines[i]); i++; }
    out.push(`<p>${inline(para.join(" "))}</p>`);
  }
  return out.join("\n");
}

const CSS = `
:root{
  --bg:#f7f8fa; --surface:#ffffff; --fg:#14161a; --muted:#667085; --border:#e3e6eb;
  --accent:#4f46e5; --accent-soft:#eef0fd;
  --pass:#15803d; --pass-soft:#e7f6ec; --fail:#c0261e; --fail-soft:#fdecec; --skip:#a15c07; --skip-soft:#fdf3e2;
  --code-bg:#f1f2f6; --shadow:0 1px 2px rgba(20,22,26,.04), 0 8px 24px -12px rgba(20,22,26,.08);
}
@media (prefers-color-scheme: dark){
  :root{
    --bg:#0b0d12; --surface:#141720; --fg:#e7e9ee; --muted:#9aa2b1; --border:#262b36;
    --accent:#8b85f8; --accent-soft:#1c1a33;
    --pass:#4ade80; --pass-soft:#12281c; --fail:#f87171; --fail-soft:#2c1616; --skip:#fbbf24; --skip-soft:#2d2410;
    --code-bg:#1a1e28; --shadow:0 1px 2px rgba(0,0,0,.3), 0 12px 32px -16px rgba(0,0,0,.6);
  }
}
*{box-sizing:border-box;}
body{background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.6;margin:0;-webkit-font-smoothing:antialiased;}
main{max-width:85vw;margin:0 auto;padding:2.5rem 1.5rem 5rem;display:flex;flex-direction:column;gap:2rem;}

.hero{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:1.75rem 2rem;box-shadow:var(--shadow);}
.hero h1{margin:0;font-size:1.75rem;font-weight:700;letter-spacing:-.01em;}
.hero p.meta{color:var(--muted);margin:.35rem 0 1.1rem;font-size:.9rem;}
.stats{display:flex;flex-wrap:wrap;gap:.5rem;}
.stat{display:inline-flex;align-items:center;padding:.35rem .8rem;border-radius:999px;font-size:.85rem;font-weight:600;background:var(--code-bg);color:var(--fg);}
.stat.pass{background:var(--pass-soft);color:var(--pass);}
.stat.fail{background:var(--fail-soft);color:var(--fail);}
.stat.skip{background:var(--skip-soft);color:var(--skip);}
.stat.total{color:var(--muted);}

.analysis{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:1.75rem 2rem;box-shadow:var(--shadow);}
.analysis>*:first-child{margin-top:0;}

h2{font-size:1.2rem;font-weight:700;margin:0 0 1rem;letter-spacing:-.01em;}
h3{font-size:1rem;font-weight:700;margin-top:1.5rem;color:var(--fg);}
p{margin:.7rem 0;}
.fail{color:var(--fail);} .skip{color:var(--skip);} .pass{color:var(--pass);}

blockquote{background:var(--accent-soft);border-left:3px solid var(--accent);margin:1.1rem 0;padding:.9rem 1.1rem;border-radius:0 10px 10px 0;color:var(--fg);}
blockquote p,blockquote ul{margin:.4rem 0;}
blockquote ul{padding-left:1.3rem;}
li{margin:.3rem 0;}

code{background:var(--code-bg);padding:.15rem .4rem;border-radius:5px;font-size:.88em;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}
pre{background:var(--code-bg);padding:.9rem 1.1rem;border-radius:10px;overflow-x:auto;font-size:.85em;border:1px solid var(--border);}

section.case-table{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:1.75rem 2rem;box-shadow:var(--shadow);}
section.case-table h2{margin-bottom:1.25rem;}
.table-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:12px;}
table{width:100%;border-collapse:collapse;font-size:.85rem;table-layout:fixed;}
th,td{padding:.65rem .8rem;text-align:left;vertical-align:top;overflow-wrap:break-word;border-bottom:1px solid var(--border);}
td{white-space:pre-wrap;}
thead th{background:var(--code-bg);color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.04em;font-weight:600;position:sticky;top:0;}
tbody tr:hover{background:color-mix(in srgb, var(--accent) 5%, transparent);}
tbody tr.row-fail{background:color-mix(in srgb, var(--fail) 5%, transparent);}
tbody tr.row-skip{background:color-mix(in srgb, var(--skip) 4%, transparent);}
tbody tr:last-child td{border-bottom:none;}
td.io{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.82em;color:var(--muted);}
th:nth-child(1),th:nth-child(2),th:nth-child(3),th:nth-child(4){width:5.5rem;}
th:nth-child(6),th:nth-child(7){width:17rem;}
th:nth-child(8){width:5rem;}

.badge{display:inline-flex;align-items:center;padding:.2rem .6rem;border-radius:6px;font-size:.78em;font-weight:700;letter-spacing:.02em;}
.badge.pass{background:var(--pass-soft);color:var(--pass);}
.badge.fail{background:var(--fail-soft);color:var(--fail);}
.badge.skip{background:var(--skip-soft);color:var(--skip);}

details{margin-top:.5rem;}
details summary{cursor:pointer;color:var(--accent);font-size:.85em;font-weight:600;}
details img{max-width:100%;border:1px solid var(--border);border-radius:8px;margin-top:.5rem;display:block;}

section:not(.case-table):not(.analysis){background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:1.75rem 2rem;box-shadow:var(--shadow);}
ul{padding-left:1.3rem;margin:.5rem 0;}
a{color:var(--accent);text-decoration:none;}
a:hover{text-decoration:underline;}
`;
