import { isDeepStrictEqual } from "node:util";

export function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

export interface ExpectSpec { status?: number; bodyMatch?: Record<string, unknown> }

export function evalExpect(spec: ExpectSpec, status: number, body: unknown): { passed: boolean; detail: string } {
  const problems: string[] = [];
  if (spec.status !== undefined && spec.status !== status) problems.push(`status: expected ${spec.status}, got ${status}`);
  for (const [path, want] of Object.entries(spec.bodyMatch ?? {})) {
    const got = getPath(body, path);
    if (!isDeepStrictEqual(got, want)) problems.push(`body.${path}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
  }
  return problems.length ? { passed: false, detail: problems.join("; ") } : { passed: true, detail: `status ${status} + ${Object.keys(spec.bodyMatch ?? {}).length} bodyMatch ok` };
}
