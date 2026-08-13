import { chromium, type Frame, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { loadConfig, resolveTarget } from "./config.js";
import { persistentOpts } from "./chrome-opts.js";
import { copyProfile, removeProfile } from "./profile.js";

const [targetName, route, ...selectors] = process.argv.slice(2);
if (!targetName || !route || selectors.length === 0) {
  console.error('Usage: pnpm e2e:probe <target> <route> "<selector>" ["<selector>" ...]');
  process.exit(1);
}

const cfg = loadConfig(resolve(process.cwd(), process.env.E2E_CONFIG ?? "e2e.config.yaml"));
const t = resolveTarget(cfg, targetName);
if (t.kind !== "browser") throw new Error(`target ${targetName} is kind=${t.kind}; probe only works on browser targets`);
if (t.auth.type !== "chrome-profile") throw new Error(`probe currently supports chrome-profile targets; ${targetName} uses ${t.auth.type}`);

const headless = process.env.E2E_HEADLESS !== "0";
const profile = copyProfile(resolve(process.cwd(), t.auth.profileDir));
let ctx: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | undefined;
try {
  ctx = await chromium.launchPersistentContext(profile, { ...persistentOpts(headless), baseURL: t.baseUrl });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const base = t.baseUrl.endsWith("/") ? t.baseUrl : `${t.baseUrl}/`;
  const url = /^https?:\/\//.test(route) ? route : new URL(route.replace(/^\//, ""), base).toString();
  await page.goto(url, { waitUntil: "load" });

  let scope: Page | Frame = page;
  if (t.appIframeSrc) {
    const handle = await page.waitForSelector(`iframe[src*="${t.appIframeSrc}"]`, { timeout: 20_000 }).catch(() => null);
    const frame = handle ? await handle.contentFrame() : null;
    if (frame) { scope = frame; console.log(`(probing inside iframe matching "${t.appIframeSrc}")`); }
    else console.log(`⚠️ iframe matching "${t.appIframeSrc}" not found — probing the outer page`);
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

  console.log(`\n${url}\n`);
  let bad = 0;
  for (const selector of selectors) {
    try {
      const locator = build(scope, selector);
      const count = await locator.count();
      if (count === 0) { bad++; console.log(`  ❌ 0 match   ${selector}`); }
      else {
        const first = locator.first();
        const visible = await first.isVisible().catch(() => false);
        const text = ((await first.innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim().slice(0, 60);
        const mark = count > 1 ? "⚠️ " : "✅ ";
        if (count > 1) bad++;
        console.log(`  ${mark}${count} match${count > 1 ? "es" : " "}  ${selector}`);
        console.log(`       visible=${visible}${text ? `  text="${text}"` : ""}`);
      }
    } catch (err) {
      bad++; console.log(`  ❌ error     ${selector} — ${(err as Error).message.split("\n")[0]}`);
    }
  }
  console.log(bad === 0
    ? `\n✅ Tất cả ${selectors.length} selector khớp đúng 1 element — an toàn để viết vào spec.`
    : `\n❌ ${bad}/${selectors.length} selector có vấn đề (0 match = đoán sai, >1 match = mơ hồ sẽ gây flaky).`);
  process.exitCode = bad === 0 ? 0 : 1;
} finally {
  await ctx?.close().catch(() => {});
  removeProfile(profile);
}
