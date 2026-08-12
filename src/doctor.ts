import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { loadConfig } from "./config.js";
import { apiAuthHeaders } from "./auth/index.js";
import type { E2EConfig, Target } from "./types.js";

const cwd = process.cwd();
const configPath = resolve(cwd, process.env.E2E_CONFIG ?? "e2e.config.yaml");
const configDir = dirname(configPath);
let fail = 0;
const ok = (m: string) => console.log(`  ✅ ${m}`);
const bad = (m: string) => { console.log(`  ❌ ${m}`); fail++; };
const warn = (m: string) => console.log(`  ⚠️  ${m}`);

console.log("E2E doctor — checking run prerequisites\n");

console.log("[1] Google Chrome (required when selected browser targets exist)");
const chrome = ["google-chrome", "google-chrome-stable", "/opt/google/chrome/chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
  .find((c) => { try { execFileSync("bash", ["-lc", `command -v "${c}" || test -x "${c}"`]); return true; } catch { return false; } });

console.log("[2] e2e.config.yaml");
if (!existsSync(configPath)) { bad(`Not found: ${configPath}`); finish(); }
let cfg: E2EConfig;
try { cfg = loadConfig(configPath); ok("Config parsed and validated (${VAR} resolved)"); }
catch (e) { bad(`Config error: ${(e as Error).message}`); finish(); }

const requested = new Set((process.env.E2E_DOCTOR_TARGETS ?? "").split(",").map((s) => s.trim()).filter(Boolean));
const entries = (Object.entries(cfg.targets ?? {}) as [string, Target][]).filter(([name]) => requested.size === 0 || requested.has(name));
if (!entries.length) { bad(requested.size ? `No configured targets match E2E_DOCTOR_TARGETS=${[...requested].join(",")}` : "No targets defined."); finish(); }

console.log("[3] Selected targets");
const hasBrowser = entries.some(([, t]) => t.kind === "browser");
if (hasBrowser && !chrome) bad("Google Chrome not found but a selected browser target is configured.");
else if (!chrome) warn("Google Chrome not found — selected targets are API-only.");

for (const [name, t] of entries) {
  const placeholder = /<.*>/.test(JSON.stringify(t));
  if (placeholder) warn(`${name}: still has <...> placeholders in config — fill in real store/app values.`);
  if (t.kind === "api" && t.auth.type === "shopify-session-jwt") {
    try { apiAuthHeaders(t.auth, configDir).Authorization ? ok(`${name}: session-JWT signed (secret resolved OK)`) : bad(`${name}: could not sign token`); }
    catch (e) { bad(`${name}: ${(e as Error).message}`); }
  } else if (t.kind === "browser" && "profileDir" in t.auth) {
    existsSync(resolve(configDir, t.auth.profileDir))
      ? ok(`${name}: profile present ${t.auth.profileDir}`)
      : bad(`${name}: Chrome profile missing — run \`pnpm e2e:login ${name}\``);
  } else ok(`${name}: kind=${t.kind}`);
}

const apiEntry = entries.find(([, t]) => t.kind === "api");
if (apiEntry) {
  console.log("[4] API reachable");
  const base = apiEntry[1].baseUrl.replace(/\/$/, "");
  let reachable = false;
  for (const p of ["/life-check", "/health/live"]) {
    try {
      const out = execFileSync("curl", ["-s", "-m", "8", "-o", "/dev/null", "-w", "%{http_code}", `${base}${p}`], { encoding: "utf8" });
      if (out.startsWith("2")) { ok(`${base}${p} → ${out}`); reachable = true; break; }
      warn(`${base}${p} → ${out}`);
    } catch { warn(`${base}${p} unreachable`); }
  }
  if (!reachable) bad(`${apiEntry[0]}: API is not reachable — stop before generating misleading test failures.`);
}

finish();

function finish(): never {
  console.log(`\n${fail ? `❌ ${fail} blocking issue(s) — fix before running.` : "✅ Ready to run."}`);
  process.exit(fail ? 1 : 0);
}
