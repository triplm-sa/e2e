import type { ApiStep, BrowserStep, CaseFile, Risk, Step, StepPhase } from "./types.js";

const phases = new Set<StepPhase>(["setup", "test", "teardown"]);
const risks = new Set<Risk>(["High", "Medium", "Low"]);
const methods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);

function fail(path: string, message: string): never {
  throw new Error(`case validation: ${path} ${message}`);
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "must be an object");
  return value as Record<string, unknown>;
}

function string(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) fail(path, "must be a non-empty string");
  return value;
}

function optionalPhase(value: unknown, path: string): StepPhase | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !phases.has(value as StepPhase)) fail(path, "must be setup|test|teardown");
  return value as StepPhase;
}

function optionalRisk(value: unknown, path: string): Risk | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !risks.has(value as Risk)) fail(path, "must be High|Medium|Low");
  return value as Risk;
}

function validateApiStep(raw: Record<string, unknown>, path: string): ApiStep {
  string(raw.target, `${path}.target`);
  const request = object(raw.request, `${path}.request`);
  const method = string(request.method, `${path}.request.method`).toUpperCase();
  if (!methods.has(method)) fail(`${path}.request.method`, `unsupported HTTP method ${method}`);
  string(request.path, `${path}.request.path`);
  const expect = object(raw.expect ?? {}, `${path}.expect`);
  if (expect.status !== undefined && (!Number.isInteger(expect.status) || (expect.status as number) < 100 || (expect.status as number) > 599)) {
    fail(`${path}.expect.status`, "must be an HTTP status code");
  }
  if (expect.bodyMatch !== undefined) object(expect.bodyMatch, `${path}.expect.bodyMatch`);
  if (raw.capture !== undefined) {
    const capture = object(raw.capture, `${path}.capture`);
    for (const [name, value] of Object.entries(capture)) {
      string(name, `${path}.capture key`);
      string(value, `${path}.capture.${name}`);
    }
  }
  return raw as unknown as ApiStep;
}

function validateBrowserStep(raw: Record<string, unknown>, path: string): BrowserStep {
  string(raw.target, `${path}.target`);
  string(raw.action, `${path}.action`);
  if (raw.spec !== undefined) string(raw.spec, `${path}.spec`);
  return raw as unknown as BrowserStep;
}

function validateStep(raw: unknown, index: number): Step {
  const path = `steps[${index}]`;
  const value = object(raw, path);
  string(value.target, `${path}.target`);
  optionalPhase(value.phase, `${path}.phase`);
  optionalRisk(value.risk, `${path}.risk`);
  if (value.case !== undefined) string(value.case, `${path}.case`);
  if (value.request !== undefined) return validateApiStep(value, path);
  if (value.action !== undefined) return validateBrowserStep(value, path);
  fail(path, "must define either request (API step) or action (browser step)");
}

export function validateCaseFile(raw: unknown): CaseFile {
  const value = object(raw, "root");
  const id = string(value.id, "id");
  const feature = string(value.feature, "feature");
  if (!Array.isArray(value.targets) || value.targets.length === 0) fail("targets", "must be a non-empty array");
  value.targets.forEach((target, index) => string(target, `targets[${index}]`));
  if (!Array.isArray(value.steps) || value.steps.length === 0) fail("steps", "must be a non-empty array");
  const steps = value.steps.map(validateStep);
  return { id, feature, targets: value.targets as string[], steps };
}
