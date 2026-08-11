import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

// One-shot re-test for one or more tasks: doctor → API (e2e:run) → browser (playwright).
// Usage: pnpm e2e:all <slug> [<slug> ...]   e.g. `pnpm e2e:all BR-55` or `pnpm e2e:all BR-55 BR-53`.
const slugs = process.argv.slice(2);
if (!slugs.length) { console.error("Usage: pnpm e2e:all <slug> [<slug> ...]"); process.exit(1); }

function run(cmd: string, args: string[], env: Record<string, string> = {}): boolean {
  try {
    execFileSync(cmd, args, { stdio: "inherit", env: { ...process.env, ...env } });
    return true;
  } catch {
    return false; // non-zero exit; keep going so later steps/tasks still run
  }
}

let anyFail = false;

// Preflight once (advisory — do not abort the run on warnings).
console.log("\n########## doctor ##########");
run("tsx", ["src/doctor.ts"]);

for (const slug of slugs) {
  console.log(`\n########## ${slug} ##########`);
  const yaml = `cases/${slug}/cases.yaml`;
  const spec = `cases/${slug}/browser/${slug}.spec.ts`;
  const outdir = `reports/${slug}`;

  if (existsSync(resolve(process.cwd(), yaml))) {
    console.log(`\n--- ${slug}: API (${yaml}) ---`);
    if (!run("tsx", ["src/run.ts", yaml])) anyFail = true;
  } else {
    console.log(`--- ${slug}: skip API — no ${yaml} ---`);
  }

  if (existsSync(resolve(process.cwd(), spec))) {
    console.log(`\n--- ${slug}: browser (${spec}) ---`);
    // A full run supersedes every partial re-run, and its own report.json covers all cases, so the
    // per-retry folders left by `pnpm e2e:retry` are cleared. Leaving them would invite reading a
    // stale partial HTML as though it described the whole task.
    rmSync(resolve(process.cwd(), `${outdir}/retry`), { recursive: true, force: true });
    if (!run("npx", ["playwright", "test", spec], { E2E_OUTDIR: outdir })) anyFail = true;
  } else {
    console.log(`--- ${slug}: skip browser — no ${spec} ---`);
  }

  console.log(`\n>>> ${slug}: report → ${outdir}/report.md  (html: ${outdir}/html/index.html)`);
}

process.exit(anyFail ? 1 : 0);
