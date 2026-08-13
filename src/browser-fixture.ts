import { test as base, expect, chromium, type BrowserContext, type Page, type TestInfo } from "@playwright/test";
import { resolve } from "node:path";
import { loadConfig } from "./config.js";
import { persistentOpts } from "./chrome-opts.js";
import { copyProfile, removeProfile } from "./profile.js";

const CONFIG_PATH = process.env.E2E_CONFIG ?? resolve(process.cwd(), "e2e.config.yaml");
const cfg = loadConfig(CONFIG_PATH);
const HEADLESS = process.env.E2E_HEADLESS === "1";

function target(name: string) {
  const t = cfg.targets[name];
  if (!t) throw new Error(`unknown target: ${name}`);
  return t;
}

type Fixtures = { consoleErrors: string[]; openTarget: (name: string) => Promise<Page> };

export const test = base.extend<Fixtures>({
  consoleErrors: async ({}, use) => {
    const errors: string[] = [];
    await use(errors);
  },
  openTarget: async ({ browser, consoleErrors }, use, testInfo) => {
    // Each openTarget call gets its own context/profile snapshot. This keeps tests independent while
    // preserving the logged-in Shopify session from the master Chrome profile.
    const contexts: BrowserContext[] = [];
    const temporaryProfiles: string[] = [];
    const pages: { name: string; page: Page }[] = [];

    const open = async (name: string) => {
      const t = target(name);
      let page: Page;
      if (t.auth.type === "chrome-profile") {
        const master = resolve(process.cwd(), t.auth.profileDir);
        const dir = copyProfile(master);
        temporaryProfiles.push(dir);
        const ctx = await chromium.launchPersistentContext(dir, { ...persistentOpts(HEADLESS), baseURL: t.baseUrl });
        contexts.push(ctx);
        page = await ctx.newPage();
      } else {
        const storageState = t.auth.type === "storage-state" ? resolve(process.cwd(), t.auth.file) : undefined;
        const ctx = await browser.newContext({ baseURL: t.baseUrl, storageState });
        contexts.push(ctx);
        page = await ctx.newPage();
      }
      pages.push({ name, page });

      const base = t.baseUrl.endsWith("/") ? t.baseUrl : `${t.baseUrl}/`;
      const origGoto = page.goto.bind(page);
      page.goto = ((url: string, opts?: Parameters<Page["goto"]>[1]) =>
        origGoto(/^https?:\/\//.test(url) ? url : new URL(url.replace(/^\//, ""), base).toString(), opts)) as Page["goto"];

      const targetHost = (() => { try { return new URL(t.baseUrl).host; } catch { return ""; } })();
      const originTag = (url: string): string => {
        if (!url) return " [origin:unknown]";
        if (/^(chrome|moz|safari-web)-extension:\/\//.test(url)) return " [browser-extension · NOISE]";
        let host = "";
        try { host = new URL(url).host; } catch { return " [origin:unknown]"; }
        return host === targetHost ? "" : ` [third-party:${host} · NOISE]`;
      };
      page.on("console", (m) => {
        if (m.type() !== "error") return;
        const url = m.location()?.url ?? "";
        consoleErrors.push(`[console.error]${originTag(url)} ${m.text()}${url ? `  (${url})` : ""}`);
      });
      page.on("pageerror", (e) => consoleErrors.push(`[pageerror] ${e.message}`));
      page.on("requestfailed", (r) => {
        let host = "";
        try { host = new URL(r.url()).host; } catch { /* ignore */ }
        if (host === targetHost) consoleErrors.push(`[requestfailed] ${r.method()} ${r.url()} ${r.failure()?.errorText ?? ""}`);
      });
      return page;
    };

    try {
      await use(open);
    } finally {
      if (consoleErrors.length) await testInfo.attach("console-errors", { body: consoleErrors.join("\n"), contentType: "text/plain" });
      for (let i = 0; i < pages.length; i++) {
        const { name, page } = pages[i];
        try {
          if (page.isClosed() || page.url() === "about:blank") continue;
          const body = await page.screenshot({ timeout: 5_000 });
          await testInfo.attach(`screenshot-${name}${pages.length > 1 ? `-${i + 1}` : ""}`, { body, contentType: "image/png" });
        } catch { /* page torn down / navigating — skip rather than fail the test */ }
      }
      for (const ctx of contexts) await ctx.close().catch(() => {});
      for (const dir of temporaryProfiles) removeProfile(dir);
    }
  },
});

/**
 * Optional per-case call so report.html shows concrete data instead of just "Playwright passed in
 * Nms". API steps get this automatically (see api-runner.ts); browser steps don't have a generic
 * request/response to read it from, so a spec calls this explicitly with whatever it set up and
 * observed, e.g. `recordIO(testInfo, "member id=42, role=Default", "role badge = 'Default'")`.
 */
export async function recordIO(testInfo: TestInfo, input: string, output: string): Promise<void> {
  await testInfo.attach("input", { body: input, contentType: "text/plain" });
  await testInfo.attach("output", { body: output, contentType: "text/plain" });
}

export { expect };
export type { Page, FrameLocator, Locator, BrowserContext } from "@playwright/test";
