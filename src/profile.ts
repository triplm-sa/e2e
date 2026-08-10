import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Chrome takes an exclusive lock on a profile directory, which is why a logged-in profile can only
 * serve one browser at a time. Copying it lifts that limit: each consumer works on its own snapshot.
 *
 * The login state lives in a handful of small files while the caches are the bulk of the directory,
 * so skipping them keeps a copy cheap (tens of megabytes become a few). The lock files must be
 * skipped too, or the copy would start out looking "already in use".
 *
 * The original is only ever read, so it cannot be corrupted by a run — but it also stops receiving
 * session refreshes, so `pnpm e2e:login <target>` remains the way to renew an expired session.
 */
const SKIP =
  /(^|\/)(Cache|Code Cache|GPUCache|DawnCache|DawnGraphiteCache|DawnWebGPUCache|ShaderCache|GrShaderCache|Shared Dictionary|CacheStorage|Service Worker|Singleton(Lock|Cookie|Socket))(\/|$)/;

/** Copy a Chrome profile to `dest` (or a fresh temp dir), skipping caches and lock files. */
export function copyProfile(source: string, dest?: string): string {
  const target = dest ?? mkdtempSync(join(tmpdir(), "e2e-profile-"));
  if (dest && existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  cpSync(source, target, { recursive: true, filter: (src) => !SKIP.test(src.slice(source.length)) });
  return target;
}

export function removeProfile(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
