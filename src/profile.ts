import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const SKIP = new Set([
  "Cache", "Code Cache", "GPUCache", "DawnCache", "DawnGraphiteCache", "DawnWebGPUCache",
  "ShaderCache", "GrShaderCache", "Shared Dictionary", "CacheStorage", "Service Worker",
  "SingletonLock", "SingletonCookie", "SingletonSocket",
]);

export function copyProfile(source: string, dest?: string): string {
  if (!existsSync(source)) throw new Error(`Chrome profile not found: ${source}. Run \`pnpm e2e:login <target>\` first.`);
  const target = dest ?? mkdtempSync(join(tmpdir(), "e2e-profile-"));
  if (dest && existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  cpSync(source, target, {
    recursive: true,
    filter: (src) => {
      const rel = relative(source, src);
      if (!rel) return true;
      return !rel.split(/[\\/]/).some((segment) => SKIP.has(segment));
    },
  });
  return target;
}

export function removeProfile(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
