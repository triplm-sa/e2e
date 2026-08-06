import { existsSync, readFileSync } from "node:fs";

/**
 * Read KEY=VALUE pairs from a .env file. Returns {} when the file does not exist.
 *
 * Quoted values are taken verbatim (so a value may legitimately contain `#`);
 * for unquoted values a trailing ` # comment` is stripped, which is what people
 * expect when they copy .env.example and leave its inline notes in place.
 */
export function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    const quoted = value.length >= 2 && /^(["']).*\1$/.test(value);
    if (quoted) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, "").trim();
    out[m[1]] = value;
  }
  return out;
}
