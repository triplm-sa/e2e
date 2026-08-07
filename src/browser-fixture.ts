import { test as base, expect, chromium, type BrowserContext, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { loadConfig } from "./config.js";
import { persistentOpts } from "./chrome-opts.js";

const CONFIG_PATH = process.env.E2E_CONFIG ?? resolve(process.cwd(), "e2e.config.yaml");
const cfg = loadConfig(CONFIG_PATH); // resolves ${VAR} from e2e/.env / process.env
const HEADLESS = process.env.E2E_HEADLESS === "1"; // window shown by default (lowers the risk of being blocked by Cloudflare).

function target(name: string) {
  const t = cfg.targets[name];
  if (!t) throw new Error(`unknown target: ${name}`);
  return t;
}

type Fixtures = {
  consoleErrors: string[];
  openTarget: (name: string) => Promise<Page>;
};

export const test = base.extend<Fixtures & { _errors: string[] }, { _profiles: Map<string, BrowserContext> }>({
  // Worker-scoped: cache the persistent context per profile directory to avoid relaunching/locking the profile repeatedly.
  _profiles: [
    async ({}, use) => {
      const m = new Map<string, BrowserContext>();
      await use(m);
      for (const ctx of m.values()) await ctx.close().catch(() => {});
    },
    { scope: "worker" },
  ],
  _errors: async ({}, use) => { await use([]); },
  consoleErrors: async ({ _errors }, use) => { await use(_errors); },
  openTarget: async ({ browser, _profiles, _errors }, use, testInfo) => {
    const perTestCtx: BrowserContext[] = []; // storage-state contexts → closed after each test
    const openedPages: Page[] = [];          // tabs opened on the persistent context → close the tab, keep the context
    const shots: { name: string; page: Page }[] = []; // pages to screenshot explicitly at teardown
    const open = async (name: string) => {
      const t = target(name);
      let page: Page;
      if (t.auth.type === "chrome-profile") {
        // Reuse the already-logged-in Chrome profile (via e2e:login). baseURL enables goto("/path").
        const dir = resolve(process.cwd(), t.auth.profileDir);
        let ctx = _profiles.get(dir);
        if (!ctx) {
          ctx = await chromium.launchPersistentContext(dir, { ...persistentOpts(HEADLESS), baseURL: t.baseUrl });
          _profiles.set(dir, ctx);
        }
        page = await ctx.newPage();
        openedPages.push(page);
      } else {
        const storageState = t.auth.type === "storage-state" ? resolve(process.cwd(), t.auth.file) : undefined;
        const ctx = await browser.newContext({ baseURL: t.baseUrl, storageState });
        perTestCtx.push(ctx);
        page = await ctx.newPage();
      }
      shots.push({ name, page });
      // Append the RELATIVE route to the FULL baseUrl (keeping the path, e.g. .../apps/<handle>) — to avoid
      // "/route" being truncated to the origin by URL resolution and losing the /store/.../apps/<handle> part.
      const base = t.baseUrl.endsWith("/") ? t.baseUrl : `${t.baseUrl}/`;
      const origGoto = page.goto.bind(page);
      page.goto = ((url: string, opts?: Parameters<Page["goto"]>[1]) =>
        origGoto(/^https?:\/\//.test(url) ? url : new URL(url.replace(/^\//, ""), base).toString(), opts)) as Page["goto"];
      // Treat requestfailed as an error only if it is on the same host as the target (drop third-party analytics/CDN noise).
      const targetHost = (() => { try { return new URL(t.baseUrl).host; } catch { return ""; } })();
      // Tag where a console message came from. Browser extensions and third-party scripts emit
      // errors that have nothing to do with the app; labelling them NOISE at capture time stops
      // them from later being misread as evidence that the app or its tunnel is down.
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
        _errors.push(`[console.error]${originTag(url)} ${m.text()}${url ? `  (${url})` : ""}`);
      });
      page.on("pageerror", (e) => _errors.push(`[pageerror] ${e.message}`));
      page.on("requestfailed", (r) => {
        let host = "";
        try { host = new URL(r.url()).host; } catch { /* ignore */ }
        if (host === targetHost) _errors.push(`[requestfailed] ${r.method()} ${r.url()} ${r.failure()?.errorText ?? ""}`);
      });
      return page;
    };
    await use(open);
    if (_errors.length) await testInfo.attach("console-errors", { body: _errors.join("\n"), contentType: "text/plain" });
    // Screenshot the REAL target pages explicitly (Playwright's built-in screenshot:"on" grabs the
    // persistent context's blank about:blank tab instead — hence the all-white images). Capture here,
    // while the page is still open and navigated, so the HTML report shows actual content.
    for (let i = 0; i < shots.length; i++) {
      const { name, page } = shots[i];
      try {
        if (page.isClosed() || page.url() === "about:blank") continue; // nothing meaningful to capture
        const body = await page.screenshot({ timeout: 5_000 });
        await testInfo.attach(`screenshot-${name}${shots.length > 1 ? `-${i + 1}` : ""}`, { body, contentType: "image/png" });
      } catch { /* page torn down / navigating — skip rather than fail the test */ }
    }
    for (const p of openedPages) await p.close().catch(() => {});
    for (const ctx of perTestCtx) await ctx.close();
  },
});

export { expect };
export type { Page, FrameLocator, Locator, BrowserContext } from "@playwright/test";
