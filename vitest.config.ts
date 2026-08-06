import { defineConfig } from "vitest/config";

// Unit test chỉ nằm trong tests/. Playwright spec (cases/browser/*.spec.ts) do `playwright test`
// chạy riêng — loại khỏi vitest để `pnpm test` không nuốt nhầm.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["cases/**", "node_modules/**", "build/**"],
  },
});
