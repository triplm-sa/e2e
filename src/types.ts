export type AuthConfig =
  | { type: "none" }
  | { type: "storage-state"; file: string }
  | {
      /**
       * Use a dedicated Chrome profile (its own directory, keeping the login session on disk).
       * Log in once (including 2FA) via `pnpm e2e:login`; subsequent test runs reuse the profile directly, no re-login needed.
       */
      type: "chrome-profile";
      /** Profile directory (relative to the e2e root), e.g. ".auth/cms-profile". */
      profileDir: string;
      /** URL to open on login (e.g. the store's Shopify Admin page). If omitted, baseUrl is opened. */
      loginUrl?: string;
    }
  | { type: "bearer-env"; envFile?: string; tokenVar: string }
  | {
      type: "shopify-session-jwt";
      /**
       * Optional. The secret is resolved in this order: process.env → e2e/.env → envFile (if declared).
       * Leave it empty and put the secret in process.env or e2e/.env for a self-contained folder that runs in any project.
       */
      envFile?: string;
      apiKeyVar: string;
      apiSecretVar: string;
      /** Domain of the dev store used for testing, declared DIRECTLY in the e2e config (portable, not taken from the app's .env). */
      shopDomain: string;
      /** Authorization header prefix. Defaults to "Bearer ". Set "" for apps that verify the token directly (e.g. the b2bridge-wholesale api). */
      headerPrefix?: string;
    };

export interface Target {
  kind: "api" | "browser";
  /**
   * Base URL for appending routes. For an app EMBEDDED in Shopify Admin (the cms target), this MUST be the Admin deep link
   * `https://admin.shopify.com/store/<store>/apps/<app-handle>` — do NOT use the app's own domain,
   * so the flow goes correctly through Admin → app (iframe) → route. Routes in the spec are appended to this full path.
   */
  baseUrl: string;
  /**
   * (Embedded app) A string matching the `src` of the iframe that holds the app UI in Admin — used for `page.frameLocator(...)`.
   * E.g. the app's own host domain. The real UI lives INSIDE this iframe, not on the outer admin page.
   */
  appIframeSrc?: string;
  auth: AuthConfig;
}

/** Source for `gen` to infer test cases. All fields are optional & per-project (portable). */
export interface RequirementsConfig {
  /** Primary ticket tracker (e.g. Jira via MCP Atlassian). */
  tracker?: "jira" | "none";
  /** Default key prefix when the user does not specify one (e.g. "TAX"). */
  jiraProjectKey?: string;
  /** Requirement/spec files in the repo used as fallback/context (paths relative to the project root). */
  docs?: string[];
  /** Repo directories to read git diffs from as context for "the feature just built". */
  diffRepos?: string[];
  /** Base branch to diff against (defaults to "master"). Diff = `git diff <baseBranch>...HEAD`. */
  baseBranch?: string;
}

export interface E2EConfig {
  targets: Record<string, Target>;
  requirements?: RequirementsConfig;
}

/**
 * Role of a step within the run.
 * - `setup`    — creates the precondition data the tests need. Runs first, in declared order.
 *                A failing setup step aborts the remaining tests (they are reported as SKIPPED,
 *                not FAILED, because they never got valid preconditions).
 * - `test`     — the actual assertions. Only these count towards the pass/fail total. Default.
 * - `teardown` — best-effort cleanup. Always runs, even after an abort, and never skips anything.
 */
export type StepPhase = "setup" | "test" | "teardown";

/** Risk rating carried over from plan.md so reports and the CSV export can show it. */
export type Risk = "High" | "Medium" | "Low";

export interface ApiStep {
  target: string;
  /** Human-readable case id, matching <feature>.plan.md (e.g. "TD-10"). */
  case?: string;
  /** Defaults to "test". */
  phase?: StepPhase;
  /** Risk rating from plan.md; surfaced in the report and CSV export. */
  risk?: Risk;
  request: { method: string; path: string; headers?: Record<string, string>; body?: unknown };
  expect: { status?: number; bodyMatch?: Record<string, unknown> };
  action?: string;
  /**
   * Save values from the response for LATER steps to use via `${var}` — chaining a business flow.
   * Key = variable name, value = path within the body (e.g. "data.member.invite_token").
   * Later steps interpolate `${var}` in path/headers/body. If a string equals exactly `${var}`,
   * the type is preserved (number/bool/object); interpolation within a string is converted to text.
   */
  capture?: Record<string, string>;
}

export interface BrowserStep {
  target: string;
  /** Human-readable case id, matching <feature>.plan.md (e.g. "TD-01"). */
  case?: string;
  /** Defaults to "test". */
  phase?: StepPhase;
  /** Risk rating from plan.md; surfaced in the report and CSV export. */
  risk?: Risk;
  action: string;
  spec?: string;
}

export type Step = ApiStep | BrowserStep;

export interface CaseFile {
  id: string;
  feature: string;
  targets: string[];
  steps: Step[];
}

export interface StepResult {
  caseId: string;
  /** Human-readable case id (e.g. "TD-10"), matching the plan. */
  case?: string;
  index: number;
  target: string;
  kind: "api" | "browser";
  /** Defaults to "test" when the step did not declare a phase. */
  phase?: StepPhase;
  risk?: Risk;
  action: string;
  passed: boolean;
  /** True when the step never ran because a setup step failed before it. */
  skipped?: boolean;
  detail: string;
  consoleErrors?: string[];
  screenshot?: string;
}

export function isApiStep(s: Step): s is ApiStep {
  return (s as ApiStep).request !== undefined;
}

/** A step's phase, defaulting to "test". */
export function phaseOf(s: Step | StepResult): StepPhase {
  return (s as { phase?: StepPhase }).phase ?? "test";
}
