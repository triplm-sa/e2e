import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig, resolveTarget } from "./config.js";
import { persistentOpts } from "./chrome-opts.js";

// Usage: pnpm e2e:login [targetName=cms]
const targetName = process.argv[2] ?? "cms";
const cfg = loadConfig(resolve(process.cwd(), process.env.E2E_CONFIG ?? "e2e.config.yaml"));
const t = resolveTarget(cfg, targetName);

if (t.auth.type === "chrome-profile") {
  // Dedicated Chrome profile: log in once (including 2FA); the session is saved directly into the profile directory.
  const dir = resolve(process.cwd(), t.auth.profileDir);
  mkdirSync(dir, { recursive: true });
  const ctx = await chromium.launchPersistentContext(dir, persistentOpts(false));
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(t.auth.loginUrl ?? t.baseUrl);
  console.log(`\n>>> Log in to Shopify (email + password + 2FA code), then open the b2bridge app in the window.`);
  console.log(`>>> When done, CLOSE the window — the session is saved to the profile: ${dir}`);
  console.log(`>>> (Later test runs reuse this profile; no re-login until Shopify expires the session.)\n`);
  await new Promise<void>((r) => ctx.on("close", () => r()));
  console.log(`✅ Session saved to profile ${dir}`);
  process.exit(0);
} else if (t.auth.type === "storage-state") {
  const file = resolve(process.cwd(), t.auth.file);
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(t.baseUrl);
  console.log(`\n>>> Log in to Shopify in the browser window and open the app. Then return to the terminal and press ENTER...`);
  await new Promise<void>((r) => process.stdin.once("data", () => r()));
  mkdirSync(resolve(file, ".."), { recursive: true });
  await ctx.storageState({ path: file });
  console.log(`Session saved to ${file}`);
  await browser.close();
  process.exit(0);
} else {
  throw new Error(`target ${targetName} does not need login (auth.type=${t.auth.type})`);
}
