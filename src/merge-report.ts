import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Merge a re-run's Playwright JSON report into the task's canonical one, newest result wins.
 *
 * Why this exists: Playwright's html and json reporters **overwrite** their output folder with
 * exactly what the current invocation ran. `pnpm e2e:retry` runs `--last-failed`, so pointing it at
 * the task's report folder replaced a full run's report with a handful of re-run cases — every case
 * that had passed silently disappeared from `html/index.html`, and the report read as though the
 * suite were far smaller than it was.
 *
 * `npx playwright merge-reports` does not solve this: it is built for shards, which cover disjoint
 * tests. Given the same test from two runs it keeps **both** entries, so a case fixed on retry still
 * shows up as failed and still counts towards `stats.unexpected`. Merging by spec id, newest wins,
 * is what a re-run actually means.
 */

type Result = { status?: string; duration?: number };
type Test = { results?: Result[]; status?: string };
type Spec = { id?: string; title?: string; file?: string; line?: number; ok?: boolean; tests?: Test[] };
type Suite = { title?: string; specs?: Spec[]; suites?: Suite[] };
export type Report = {
  config?: unknown;
  stats: { expected: number; unexpected: number; skipped: number; flaky: number; duration: number };
  suites: Suite[];
};

/** Identity of a spec across runs. `id` is stable for a given file+title; fall back for hand-made reports. */
const keyOf = (s: Spec) => s.id ?? `${s.file ?? ""}:${s.title ?? ""}`;

function eachSpec(suites: Suite[] | undefined, visit: (s: Spec, parent: Suite) => void): void {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) visit(spec, suite);
    eachSpec(suite.suites, visit);
  }
}

export function countSpecs(report: Report): number {
  let n = 0;
  eachSpec(report.suites, () => n++);
  return n;
}

/** Every spec of the incoming report, indexed by identity. */
function indexSpecs(report: Report): Map<string, Spec> {
  const byKey = new Map<string, Spec>();
  eachSpec(report.suites, (s) => byKey.set(keyOf(s), s));
  return byKey;
}

/**
 * Locate the suite in `base` that should receive a spec the base does not have yet, matching the
 * incoming report's suite by title. Falls back to the first top-level suite so a new case is never
 * dropped just because its group is new.
 */
function suiteFor(base: Report, title: string | undefined): Suite {
  let found: Suite | undefined;
  const walk = (suites: Suite[] | undefined) => {
    for (const s of suites ?? []) {
      if (!found && s.title === title) found = s;
      walk(s.suites);
    }
  };
  walk(base.suites);
  if (found) return found;
  if (!base.suites.length) base.suites.push({ title, specs: [], suites: [] });
  const fallback = base.suites[0];
  fallback.specs ??= [];
  return fallback;
}

/** A spec counts as passed when Playwright marked it ok; otherwise it is a failure or a skip. */
function tallyInto(stats: Report["stats"], spec: Spec): void {
  const statuses = (spec.tests ?? []).flatMap((t) => (t.results ?? []).map((r) => r.status));
  if (statuses.length && statuses.every((s) => s === "skipped")) stats.skipped++;
  else if (spec.ok) stats.expected++;
  else stats.unexpected++;
}

/**
 * Return a new report holding every spec of `base`, with any spec the retry re-ran replaced by the
 * retry's result. Specs absent from the retry are untouched — that is the whole point.
 */
export function mergeReports(base: Report, incoming: Report): Report {
  const merged: Report = JSON.parse(JSON.stringify(base));
  const fresh = indexSpecs(incoming);
  const seen = new Set<string>();

  // Replace in place, so a spec keeps its position in the tree the tester already knows.
  eachSpec(merged.suites, (spec, parent) => {
    const replacement = fresh.get(keyOf(spec));
    if (!replacement) return;
    seen.add(keyOf(spec));
    const at = (parent.specs ?? []).indexOf(spec);
    if (at >= 0) parent.specs![at] = JSON.parse(JSON.stringify(replacement));
  });

  // A spec the retry ran that the base never had (a newly written case) is appended, not lost.
  eachSpec(incoming.suites, (spec, parent) => {
    if (seen.has(keyOf(spec))) return;
    const target = suiteFor(merged, parent.title);
    target.specs ??= [];
    target.specs.push(JSON.parse(JSON.stringify(spec)));
  });

  // Stats must come from the merged tree. Copying either side's would describe a run that never
  // happened: the base's counts predate the fix, the retry's cover only the cases it re-ran.
  const stats = { expected: 0, unexpected: 0, skipped: 0, flaky: 0, duration: 0 };
  eachSpec(merged.suites, (s) => tallyInto(stats, s));
  stats.duration = (base.stats?.duration ?? 0) + (incoming.stats?.duration ?? 0);
  stats.flaky = base.stats?.flaky ?? 0;
  merged.stats = { ...merged.stats, ...stats };
  return merged;
}

/** CLI: `tsx src/merge-report.ts <canonical.json> <incoming.json>` — rewrites the canonical file. */
if (process.argv[1]?.endsWith("merge-report.ts")) {
  const [basePath, incomingPath] = process.argv.slice(2);
  if (!basePath || !incomingPath) {
    console.error("Usage: tsx src/merge-report.ts <canonical report.json> <incoming report.json>");
    process.exit(1);
  }
  const abs = (p: string) => resolve(process.cwd(), p);
  if (!existsSync(abs(incomingPath))) {
    console.error(`No incoming report at ${incomingPath}`);
    process.exit(1);
  }
  const incoming = JSON.parse(readFileSync(abs(incomingPath), "utf8")) as Report;
  // With no canonical report yet, the incoming one becomes it.
  const base = existsSync(abs(basePath))
    ? (JSON.parse(readFileSync(abs(basePath), "utf8")) as Report)
    : ({ stats: { expected: 0, unexpected: 0, skipped: 0, flaky: 0, duration: 0 }, suites: [] } as Report);

  const merged = mergeReports(base, incoming);
  writeFileSync(abs(basePath), JSON.stringify(merged, null, 2));
  const { expected, unexpected, skipped } = merged.stats;
  console.log(
    `▸ merged into ${basePath}: ${countSpecs(merged)} case · ${expected} pass · ${unexpected} fail` +
      (skipped ? ` · ${skipped} skipped` : ""),
  );
}
