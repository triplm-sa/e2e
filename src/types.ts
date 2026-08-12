export type AuthConfig =
  | { type: "none" }
  | { type: "storage-state"; file: string }
  | { type: "chrome-profile"; profileDir: string; loginUrl?: string }
  | { type: "bearer-env"; envFile?: string; tokenVar: string }
  | { type: "shopify-session-jwt"; envFile?: string; apiKeyVar: string; apiSecretVar: string; shopDomain: string; headerPrefix?: string };

export interface Target {
  kind: "api" | "browser";
  baseUrl: string;
  appIframeSrc?: string;
  auth: AuthConfig;
}

export interface RequirementsConfig {
  tracker?: "jira" | "none";
  jiraProjectKey?: string;
  docs?: string[];
  diffRepos?: string[];
  baseBranch?: string;
}

export interface E2EConfig { targets: Record<string, Target>; requirements?: RequirementsConfig }
export type StepPhase = "setup" | "test" | "teardown";
export type Risk = "High" | "Medium" | "Low";
export type FailureType = "configuration" | "environment" | "assertion" | "setup" | "teardown" | "unknown";

export interface ApiStep {
  target: string; case?: string; phase?: StepPhase; risk?: Risk;
  request: { method: string; path: string; headers?: Record<string, string>; body?: unknown };
  expect: { status?: number; bodyMatch?: Record<string, unknown> };
  action?: string;
  capture?: Record<string, string>;
}

export interface BrowserStep { target: string; case?: string; phase?: StepPhase; risk?: Risk; action: string; spec?: string }
export type Step = ApiStep | BrowserStep;
export interface CaseFile { id: string; feature: string; targets: string[]; steps: Step[] }

export interface StepResult {
  caseId: string; case?: string; index: number; target: string; kind: "api" | "browser";
  phase?: StepPhase; risk?: Risk; action: string; passed: boolean; skipped?: boolean;
  failureType?: FailureType; detail: string; consoleErrors?: string[]; screenshot?: string;
}

export function isApiStep(s: Step): s is ApiStep { return (s as ApiStep).request !== undefined }
export function phaseOf(s: Step | StepResult): StepPhase { return (s as { phase?: StepPhase }).phase ?? "test" }
