import { describe, it, expect, afterEach } from "vitest";
import { writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readEnvFile } from "../src/env.js";

const dirs: string[] = [];
function envFile(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), "e2e-env-"));
  dirs.push(dir);
  const path = join(dir, ".env");
  writeFileSync(path, contents);
  return path;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("readEnvFile", () => {
  it("returns an empty object when the file does not exist", () => {
    expect(readEnvFile("/definitely/not/here/.env")).toEqual({});
  });

  it("strips an inline comment from an unquoted value", () => {
    // .env.example ships inline notes; copying it must not fold the comment into the value.
    const env = readEnvFile(envFile("STORE=my-store        # phần trước .myshopify.com\n"));
    expect(env.STORE).toBe("my-store");
  });

  it("keeps a '#' that belongs to a quoted value", () => {
    const env = readEnvFile(envFile(`SECRET="a#b"\nOTHER='c#d'\n`));
    expect(env.SECRET).toBe("a#b");
    expect(env.OTHER).toBe("c#d");
  });

  it("ignores comment and blank lines, and trims surrounding whitespace", () => {
    const env = readEnvFile(envFile("# a comment\n\n  KEY = value  \n"));
    expect(env).toEqual({ KEY: "value" });
  });

  it("keeps an empty value empty rather than dropping the key", () => {
    const env = readEnvFile(envFile("API_ENV_FILE=\n"));
    expect(env.API_ENV_FILE).toBe("");
  });
});
