import { apiAuthHeaders } from "./auth/index.js";
import { evalExpect, getPath } from "./assert.js";
import type { ApiStep, Target, StepResult } from "./types.js";

/** Interpolate `${var}` with captured values. A string equal to exactly `${var}` → preserves the type; within a string → text. */
function interpolate(value: unknown, vars: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    const exact = value.match(/^\$\{(\w+)\}$/);
    if (exact) return exact[1] in vars ? vars[exact[1]] : value; // preserve the type (number/bool/object)
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

export async function runApiStep(
  step: ApiStep,
  target: Target,
  configDir: string,
  caseId: string,
  index: number,
  vars: Record<string, unknown> = {},
): Promise<{ result: StepResult; captured: Record<string, unknown> }> {
  const path = interpolate(step.request.path, vars) as string;
  const base = {
    caseId, case: step.case, index, target: step.target, kind: "api" as const,
    action: step.action ?? `${step.request.method} ${path}`,
  };
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...apiAuthHeaders(target.auth, configDir),
      ...((interpolate(step.request.headers ?? {}, vars)) as Record<string, string>),
    };
    const body = step.request.body !== undefined ? interpolate(step.request.body, vars) : undefined;
    const res = await fetch(target.baseUrl + path, {
      method: step.request.method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* keep text */ }

    // Capture values from the response for later steps (only when present, to avoid noise).
    const captured: Record<string, unknown> = {};
    const missing: string[] = [];
    for (const [name, bodyPath] of Object.entries(step.capture ?? {})) {
      const v = getPath(parsed, bodyPath);
      if (v === undefined) missing.push(`${name}←${bodyPath}`);
      else captured[name] = v;
    }

    const { passed, detail } = evalExpect(step.expect, res.status, parsed);
    const captureNote = missing.length ? `; missing capture: ${missing.join(", ")}` : "";
    return {
      result: { ...base, passed: passed && missing.length === 0, detail: detail + captureNote },
      captured,
    };
  } catch (err) {
    return { result: { ...base, passed: false, detail: `request error: ${(err as Error).message}` }, captured: {} };
  }
}
