import { resolve, dirname } from "node:path";
import { mintSessionToken } from "./session-jwt.js";
import { readEnvFile } from "../env.js";
import type { AuthConfig } from "../types.js";

/**
 * Resolve env variables FLEXIBLY by priority order (runs in any project, no code changes):
 *   1) process.env            — CI / `export VAR=...` before running
 *   2) e2e/.env               — self-contained folder (portable)
 *   3) envFile (if declared)  — e.g. ../b2bridge-api/.env when carrying the whole monorepo
 * `configDir` = the directory containing e2e.config.yaml.
 */
function resolveVars(names: string[], configDir: string, envFile?: string): Record<string, string> {
  const local = readEnvFile(resolve(configDir, ".env"));
  const external = envFile ? readEnvFile(resolve(configDir, envFile)) : {};
  const out: Record<string, string> = {};
  for (const n of names) {
    const v = process.env[n] ?? local[n] ?? external[n];
    if (v) out[n] = v;
  }
  return out;
}

/** Return the Authorization headers for an api target based on its auth strategy. configDir = the directory containing e2e.config.yaml. */
export function apiAuthHeaders(auth: AuthConfig, configDir: string): Record<string, string> {
  switch (auth.type) {
    case "none":
      return {};
    case "bearer-env": {
      const env = resolveVars([auth.tokenVar], configDir, auth.envFile);
      const tok = env[auth.tokenVar];
      if (!tok) throw new Error(`bearer-env: ${auth.tokenVar} not found (process.env / e2e/.env / ${auth.envFile ?? "envFile not set"})`);
      return { Authorization: `Bearer ${tok}` };
    }
    case "shopify-session-jwt": {
      const env = resolveVars([auth.apiKeyVar, auth.apiSecretVar], configDir, auth.envFile);
      const apiKey = env[auth.apiKeyVar];
      const apiSecret = env[auth.apiSecretVar];
      if (!apiKey || !apiSecret) throw new Error(`shopify-session-jwt: ${auth.apiKeyVar}/${auth.apiSecretVar} not found (tried process.env → e2e/.env → ${auth.envFile ?? "envFile not set"})`);
      const token = mintSessionToken({ apiKey, apiSecret, shop: auth.shopDomain });
      const prefix = auth.headerPrefix ?? "Bearer ";
      return { Authorization: `${prefix}${token}` };
    }
    case "storage-state":
      throw new Error("storage-state is only for kind=browser targets, not api");
    case "chrome-profile":
      throw new Error("chrome-profile is only for kind=browser targets, not api");
    default: {
      const _exhaustive: never = auth;
      throw new Error(`unsupported auth.type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export { dirname };
