import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { parse } from "yaml";
import { readEnvFile } from "./env.js";
import type { E2EConfig, Target } from "./types.js";

/**
 * Interpolate `${VAR}` placeholders in the config text so per-project values live in one .env file
 * instead of being edited inline. Precedence: process.env → e2e/.env (same dir as the config).
 * `${VAR:-default}` uses `default` when VAR is unset. Full-line comments (`#...`) are left untouched.
 * Any remaining unresolved `${VAR}` throws.
 */
export function interpolateEnv(text: string, envDir: string): string {
  const fileEnv = readEnvFile(resolve(envDir, ".env"));
  const missing = new Set<string>();
  const sub = (line: string) =>
    line.replace(/\$\{([A-Z0-9_]+)(?::-([^}]*))?\}/g, (_m, name, dflt) => {
      const v = process.env[name] ?? fileEnv[name] ?? dflt;
      if (v === undefined) { missing.add(name); return ""; }
      return v;
    });
  const out = text
    .split("\n")
    .map((line) => (/^\s*#/.test(line) ? line : sub(line)))
    .join("\n");
  if (missing.size) {
    throw new Error(
      `config: undefined variable(s): ${[...missing].join(", ")}. ` +
      `Define them in e2e/.env (or process.env), or use the \${VAR:-default} syntax.`,
    );
  }
  return out;
}

export function parseConfig(text: string): E2EConfig {
  const raw = parse(text);
  if (!raw?.targets || typeof raw.targets !== "object") {
    throw new Error("config: `targets` is required");
  }
  for (const [name, t] of Object.entries(raw.targets as Record<string, Target>)) {
    if (t.kind !== "api" && t.kind !== "browser") throw new Error(`target ${name}: kind must be api|browser`);
    if (!t.baseUrl) throw new Error(`target ${name}: baseUrl is required`);
    if (!t.auth?.type) throw new Error(`target ${name}: auth.type is required`);
  }
  return raw as E2EConfig;
}

export function loadConfig(path: string): E2EConfig {
  const text = interpolateEnv(readFileSync(path, "utf8"), dirname(path));
  return parseConfig(text);
}

export function resolveTarget(cfg: E2EConfig, name: string): Target {
  const t = cfg.targets[name];
  if (!t) throw new Error(`unknown target: ${name}`);
  return t;
}
