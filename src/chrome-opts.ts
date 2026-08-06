// Chrome launch flags SHARED between login (src/login.ts) and test runs (browser-fixture.ts).
// Goal: use REAL Chrome + reduce automation fingerprints to get past Shopify's Cloudflare challenge.
export function persistentOpts(headless: boolean) {
  return {
    headless,
    channel: "chrome" as const,
    args: ["--disable-blink-features=AutomationControlled"],
    ignoreDefaultArgs: ["--enable-automation"],
  };
}
