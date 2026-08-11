import { chromium, type Frame, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { loadConfig, resolveTarget } from "./config.js";
import { persistentOpts } from "./chrome-opts.js";
// Probing runs on a copy so it never fights a running suite for Chrome's profile lock.
import { copyProfile, removeProfile } from "./profile.js";

/**
 * Check selectors against a live page without running the test suite.
 *
 *   pnpm e2e:probe <target> <route> "<selector>" ["<selector>" ...]
 *   pnpm e2e:probe cms /settings "getByRole:button:Save" "#total"
 *
 * Discovering a wrong selector by running the spec costs a full browser test; this costs one page
 * load. Use it while writing or repairing a spec, then run the test once the selectors are known
 * to match. A selector is reported with how many elements it matches, so `0` (guessed wrong) and
 * `>1` (ambiguous, will be flaky) are both visible before any test is written.
 *
 * Selector syntax: a raw CSS/XPath string, or `getByRole:<role>:<name>`, `getByLabel:<text>`,
 * `getByText:<text>`, `getByPlaceholder:<text>`, `getByTestId:<id>` for the recommended
 * user-facing locators.
 */
const [targetName, route, ...selectors] = process.argv.slice(2);
if (!targetName || !route || selectors.length === 0) {
  console.error('Usage: pnpm e2e:probe <target> <route> "<selector>" ["<selector>" ...]');
  process.exit(1);
}

const cfg = loadConfig(resolve(process.cwd(), process.env.E2E_CONFIG ?? "e2e.config.yaml"));
const t = resolveTarget(cfg, targetName);
if (t.kind !== "browser") throw new Error(`target ${targetName} is kind=${t.kind}; probe only works on browser targets`);
if (t.auth.type !== "chrome-profile") throw new Error(`probe currently supports chrome-profile targets; ${targetName} uses ${t.auth.type}`);

const headless = process.env.E2E_HEADLESS !== "0"; // probing is non-interactive, so default to headless for speed
const profile = copyProfile(resolve(process.cwd(), t.auth.profileDir));
const ctx = await chromium.launchPersistentContext(profile, { ...persistentOpts(headless), baseURL: t.baseUrl });
const page = ctx.pages()[0] ?? (await ctx.newPage());

const base = t.baseUrl.endsWith("/") ? t.baseUrl : `${t.baseUrl}/`;
const url = /^https?:\/\//.test(route) ? route : new URL(route.replace(/^\//, ""), base).toString();
await page.goto(url, { waitUntil: "load" });

// An embedded app renders inside an iframe; probing the outer page would report 0 for everything.
let scope: Page | Frame = page;
if (t.appIframeSrc) {
  const handle = await page.waitForSelector(`iframe[src*="${t.appIframeSrc}"]`, { timeout: 20_000 }).catch(() => null);
  const frame = handle ? await handle.contentFrame() : null;
  if (frame) { scope = frame; console.log(`(probing inside iframe matching "${t.appIframeSrc}")`); }
  else console.log(`⚠️  iframe matching "${t.appIframeSrc}" not found — probing the outer page`);
}

function build(scope: Page | Frame, selector: string) {
  const [kind, ...rest] = selector.split(":");
  const arg = rest.join(":");
  switch (kind) {
    case "getByRole": {
      const [role, ...nameParts] = arg.split(":");
      const name = nameParts.join(":");
      return scope.getByRole(role as Parameters<Page["getByRole"]>[0], name ? { name } : undefined);
    }
    case "getByLabel": return scope.getByLabel(arg);
    case "getByText": return scope.getByText(arg);
    case "getByPlaceholder": return scope.getByPlaceholder(arg);
    case "getByTestId": return scope.getByTestId(arg);
    default: return scope.locator(selector);
  }
}

// An embedded Shopify app finishes booting long after the outer page fires `load`
// (Admin + App Bridge + the app's own first fetch — measured at 7-20s). Counting
// straight away reports `0 match` for every selector, which reads as "all wrong"
// when the page simply had not rendered yet. So poll until the first selector
// matches, then report. A page where nothing ever matches still costs only this
// bounded wait, and its report is then genuine.
const warmupMs = Number(process.env.E2E_PROBE_WARMUP_MS ?? 25_000);
const deadline = Date.now() + warmupMs;
while (Date.now() < deadline) {
  let anyMatch = false;
  for (const selector of selectors) {
    const count = await build(scope, selector).count().catch(() => 0);
    if (count > 0) { anyMatch = true; break; }
  }
  if (anyMatch) break;
  await new Promise((r) => setTimeout(r, 1_000));
}

console.log(`\n${url}\n`);
let bad = 0;
for (const selector of selectors) {
  try {
    const locator = build(scope, selector);
    const count = await locator.count();
    if (count === 0) {
      bad++;
      console.log(`  ❌ 0 match   ${selector}`);
    } else {
      const first = locator.first();
      const visible = await first.isVisible().catch(() => false);
      const text = ((await first.innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim().slice(0, 60);
      const mark = count > 1 ? "⚠️ " : "✅ ";
      if (count > 1) bad++;
      console.log(`  ${mark}${count} match${count > 1 ? "es" : " "}  ${selector}`);
      console.log(`       visible=${visible}${text ? `  text="${text}"` : ""}`);
    }
  } catch (err) {
    bad++;
    console.log(`  ❌ error     ${selector} — ${(err as Error).message.split("\n")[0]}`);
  }
}

console.log(
  bad === 0
    ? `\n✅ Tất cả ${selectors.length} selector khớp đúng 1 element — an toàn để viết vào spec.`
    : `\n❌ ${bad}/${selectors.length} selector có vấn đề (0 match = đoán sai, >1 match = mơ hồ sẽ gây flaky).`,
);
await ctx.close();
removeProfile(profile);
process.exit(bad === 0 ? 0 : 1);
