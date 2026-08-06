import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { parse } from "yaml";
import { interpolateEnv } from "./config.js";
import { apiAuthHeaders } from "./auth/index.js";
import type { E2EConfig, Target } from "./types.js";

// Preflight: "can e2e be dropped in here and run yet?" — check every dependency, print green/red.
const cwd = process.cwd();
const configPath = resolve(cwd, process.env.E2E_CONFIG ?? "e2e.config.yaml");
const configDir = dirname(configPath);

let fail = 0;
const ok = (m: string) => console.log(`  ✅ ${m}`);
const bad = (m: string) => { console.log(`  ❌ ${m}`); fail++; };
const warn = (m: string) => console.log(`  ⚠️  ${m}`);

console.log("E2E doctor — checking run prerequisites\n");

// 1) Real Chrome
console.log("[1] Google Chrome (browser targets use channel: chrome)");
const chrome = ["google-chrome", "google-chrome-stable", "/opt/google/chrome/chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
  .find((c) => { try { execFileSync("bash", ["-lc", `command -v "${c}" || test -x "${c}"`]); return true; } catch { return false; } });
chrome ? ok(`Chrome: ${chrome}`) : warn("Google Chrome not found — browser targets won't run (api targets still work).");

// 2) Config exists + parses
console.log("[2] e2e.config.yaml");
if (!existsSync(configPath)) { bad(`Not found: ${configPath}`); done(); }
let cfg: E2EConfig;
try { cfg = parse(interpolateEnv(readFileSync(configPath, "utf8"), configDir)) as E2EConfig; ok("Config parsed OK (${VAR} resolved)"); }
catch (e) { bad(`Config error: ${(e as Error).message}`); done(); throw e; }

// 3) Each target
console.log("[3] Targets");
const entries = Object.entries(cfg.targets ?? {});
if (!entries.length) bad("No targets defined.");
for (const [name, t] of entries as [string, Target][]) {
  const placeholder = /<.*>/.test(JSON.stringify(t));
  if (placeholder) warn(`${name}: still has <...> placeholders in config — fill in real store/app values.`);
  if (t.kind === "api" && t.auth.type === "shopify-session-jwt") {
    try { const h = apiAuthHeaders(t.auth, configDir); h.Authorization ? ok(`${name}: session-JWT signed (secret resolved OK)`) : bad(`${name}: could not sign token`); }
    catch (e) { bad(`${name}: ${(e as Error).message}`); }
  } else if (t.kind === "browser" && "profileDir" in t.auth) {
    existsSync(resolve(configDir, t.auth.profileDir))
      ? ok(`${name}: profile present ${t.auth.profileDir}`)
      : warn(`${name}: no profile yet → run \`pnpm e2e:login ${name}\``);
  } else ok(`${name}: kind=${t.kind}`);
}

// 4) API alive (first target with kind=api)
const apiEntry = (entries as [string, Target][]).find(([, t]) => t.kind === "api");
if (apiEntry) {
  console.log("[4] API reachable");
  const base = apiEntry[1].baseUrl;
  for (const p of ["/life-check", "/health/live"]) {
    try {
      const out = execFileSync("curl", ["-s", "-m", "8", "-o", "/dev/null", "-w", "%{http_code}", base + p], { encoding: "utf8" });
      if (out.startsWith("2")) { ok(`${base}${p} → ${out}`); break; }
      else warn(`${base}${p} → ${out}`);
    } catch { warn(`${base}${p} unreachable`); }
  }
}

function done() {
  console.log(`\n${fail ? `❌ ${fail} error(s) — fix before running.` : "✅ Ready to run."}`);
  process.exit(fail ? 1 : 0);
}
done();
