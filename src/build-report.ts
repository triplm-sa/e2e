import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderHtmlReport, type ExecutionReport } from "./report.js";

const slug = process.argv[2];
if (!slug) { console.error("Usage: pnpm e2e:report:build <slug>"); process.exit(1); }

const cwd = process.cwd();
const reportDir = resolve(cwd, "reports", slug);
const dataDir = resolve(reportDir, "data");
const reportJsonPath = resolve(dataDir, "report.json");
const analysisPath = resolve(dataDir, "analysis.md");

if (!existsSync(reportJsonPath)) {
  console.error(`Missing ${reportJsonPath} — run \`pnpm e2e:all ${slug}\` first.`);
  process.exit(1);
}

const report = JSON.parse(readFileSync(reportJsonPath, "utf8")) as ExecutionReport;
const analysisMd = existsSync(analysisPath)
  ? readFileSync(analysisPath, "utf8")
  : "## Bug\n\n> Chưa có phân tích — điền `data/analysis.md` rồi build lại.";

const html = renderHtmlReport(report, analysisMd);
const outPath = resolve(reportDir, "report.html");
writeFileSync(outPath, html);
console.log(`>>> ${slug}: final report → ${outPath}`);
