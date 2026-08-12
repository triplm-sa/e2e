import { apiAuthHeaders } from "./auth/index.js";
import { evalExpect, getPath } from "./assert.js";
import type { ApiStep, Target, StepResult } from "./types.js";

const API_TIMEOUT_MS = Number(process.env.E2E_API_TIMEOUT ?? 30_000);

export function interpolate(value: unknown, vars: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    const exact = value.match(/^\$\{(\w+)\}$/);
    if (exact) return exact[1] in vars ? vars[exact[1]] : value;
    return value.replace(/\$\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
  }
  if (Array.isArray(value)) return value.map((v) => interpolate(v, vars));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = interpolate(v, vars);
    return out;
  }
  return value;
}

export function joinUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\/+/, ""), base).toString();
}

export async function runApiStep(
  step: ApiStep,
  target: Target,
  configDir: string,
  caseId: string,
  index: number,
  vars: Record<string, unknown> = {},
): Promise<{ result: StepResult; captured: Record<string, unknown> }> {
  const path = interpolate(step.request.path, vars) as string;
  const base = { caseId, case: step.case, index, target: step.target, kind: "api" as const, action: step.action ?? `${step.request.method} ${path}` };
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json", ...apiAuthHeaders(target.auth, configDir),
      ...((interpolate(step.request.headers ?? {}, vars)) as Record<string, string>),
    };
    const body = step.request.body !== undefined ? interpolate(step.request.body, vars) : undefined;
    const res = await fetch(joinUrl(target.baseUrl, path), {
      method: step.request.method, headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    const text = await res.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* keep text */ }

    const captured: Record<string, unknown> = {};
    const missing: string[] = [];
    for (const [name, bodyPath] of Object.entries(step.capture ?? {})) {
      const v = getPath(parsed, bodyPath);
      if (v === undefined) missing.push(`${name}←${bodyPath}`); else captured[name] = v;
    }
    const { passed, detail } = evalExpect(step.expect, res.status, parsed);
    const captureNote = missing.length ? `; missing capture: ${missing.join(", ")}` : "";
    return { result: { ...base, passed: passed && missing.length === 0, detail: detail + captureNote }, captured };
  } catch (err) {
    const e = err as Error;
    const detail = e.name === "TimeoutError" || e.name === "AbortError"
      ? `timeout sau ${API_TIMEOUT_MS / 1000}s — ${step.request.method} ${path} không phản hồi. Kiểm tra API còn sống hoặc tăng E2E_API_TIMEOUT.`
      : `request error: ${e.message}`;
    return { result: { ...base, passed: false, detail }, captured: {} };
  }
}
