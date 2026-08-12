import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { isApiStep } from "./types.js";
import type { CaseFile, Step } from "./types.js";

/**
 * Mechanical gate between `e2e-gen`'s plan.md and what actually got compiled.
 *
 *   pnpm e2e:verify <slug>
 *
 * A written rule ("every automatable case must have a compiled step and, for browser cases, a
 * matching test()") only works if someone re-reads it at the right moment. This script makes the
 * same check without relying on that: it diffs plan.md's case ids against cases.yaml, and for
 * every browser-kind step, checks the referenced spec file actually contains a test for that id.
 * Exits 1 and prints exactly what is missing — nothing is inferred or assumed passing.
 */
const slug = process.argv[2];
if (!slug) {
  console.error("Usage: pnpm e2e:verify <slug>");
  process.exit(1);
}

const cwd = process.cwd();
const caseDir = resolve(cwd, "cases", slug);
const planPath = resolve(caseDir, "plan.md");
const yamlPath = resolve(caseDir, "cases.yaml");

if (!existsSync(planPath)) {
  console.error(`❌ ${planPath} not found — nothing to verify against.`);
  process.exit(1);
}
if (!existsSync(yamlPath)) {
  console.error(`❌ ${yamlPath} not found — plan.md exists but nothing was compiled yet.`);
  process.exit(1);
}

// ---- 1. Extract case ids marked automatable from plan.md's case table ----
// A row looks like: | TD-01 | AC-CFG-01 | High | ... | ✅ Tự động ... |
// The case id is the first cell; "automatable" is judged by a ✅ anywhere in the row (the
// Automatable? column is last, but content wraps, so scanning the whole row is more robust
// than assuming column position).
const planText = readFileSync(planPath, "utf8");
const rowRe = /^\|\s*(TD-[A-Za-z0-9]+)\s*\|(.*)\|\s*$/gm;
const planCases: { id: string; automatable: boolean; raw: string }[] = [];
for (const m of planText.matchAll(rowRe)) {
  const id = m[1];
  const rest = m[2];
  if (id === "#") continue; // header row, e.g. "| # | AC | ..." never matches TD- anyway, but guard
  planCases.push({ id, automatable: rest.includes("✅"), raw: m[0] });
}
if (planCases.length === 0) {
  console.error(`❌ No case rows (| TD-xx | ... |) found in ${planPath} — check the table format.`);
  process.exit(1);
}

// ---- 2. Load cases.yaml, index every declared case id by kind ----
const cf = parse(readFileSync(yamlPath, "utf8")) as CaseFile;
type YamlEntry = { step: Step; kind: "api" | "browser" };
const yamlByCase = new Map<string, YamlEntry[]>();
for (const step of cf.steps) {
  const id = step.case;
  if (!id) continue;
  const kind: "api" | "browser" = isApiStep(step) ? "api" : "browser";
  const list = yamlByCase.get(id) ?? [];
  list.push({ step, kind });
  yamlByCase.set(id, list);
}

// ---- 3. For browser-kind ids, load the referenced spec file(s) and look for a matching test() ----
const specCache = new Map<string, string | null>();
function specContent(specRelPath: string): string | null {
  if (specCache.has(specRelPath)) return specCache.get(specRelPath)!;
  const full = resolve(caseDir, specRelPath);
  const content = existsSync(full) ? readFileSync(full, "utf8") : null;
  specCache.set(specRelPath, content);
  return content;
}
function hasTestFor(id: string, content: string): boolean {
  // Matches test("TD-01 · ...") / test("TD-01" ...) / test(`TD-01 ...`) — id followed by a
  // non-alphanumeric boundary so TD-1 doesn't false-match inside TD-10.
  const re = new RegExp(`test\\(["'\`]${id}(?![A-Za-z0-9])`);
  return re.test(content);
}
const defaultSpecRel = `browser/${slug}.spec.ts`;

// ---- 4. Diff and report ----
let missing = 0;
let manualSkipped = 0;
const lines: string[] = [];

for (const { id, automatable } of planCases) {
  if (!automatable) {
    manualSkipped++;
    lines.push(`⏭️  ${id} — không đánh automatable trong plan.md, bỏ qua kiểm tra`);
    continue;
  }
  const entries = yamlByCase.get(id);
  if (!entries || entries.length === 0) {
    missing++;
    lines.push(`❌ ${id} — automatable trong plan.md nhưng KHÔNG có step nào trong cases.yaml`);
    continue;
  }
  for (const { step, kind } of entries) {
    if (kind === "api") {
      lines.push(`✅ ${id} — api step trong cases.yaml (chạy được qua pnpm e2e:run)`);
      continue;
    }
    const specRel = (step as { spec?: string }).spec || defaultSpecRel;
    const content = specContent(specRel);
    if (content === null) {
      missing++;
      lines.push(`❌ ${id} — cases.yaml khai browser step nhưng file spec "${specRel}" không tồn tại`);
    } else if (!hasTestFor(id, content)) {
      missing++;
      lines.push(`❌ ${id} — spec "${specRel}" tồn tại nhưng không có test() nào cho case này`);
    } else {
      lines.push(`✅ ${id} — browser step + test() khớp trong "${specRel}"`);
    }
  }
}

console.log(`\nVerify coverage: cases/${slug}\n`);
console.log(lines.join("\n"));
console.log(
  `\n${planCases.length} case trong plan.md — ${planCases.length - manualSkipped - missing}/${planCases.length - manualSkipped} automatable case đã compile đúng, ${manualSkipped} case đánh manual (bỏ qua), ${missing} case THIẾU.`,
);

if (missing > 0) {
  console.log(`\n❌ FAIL — ${missing} case automatable chưa được compile đầy đủ. Không được báo stage gen/run là "xong" khi còn dòng ❌ ở trên.`);
  process.exit(1);
}
console.log(`\n✅ PASS — mọi case automatable trong plan.md đều có mặt trong cases.yaml (và spec test nếu là browser).`);
