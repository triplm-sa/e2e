import { describe, it, expect } from "vitest";
import { parseConfig, resolveTarget } from "../src/config.js";

const YAML = `
targets:
  api:
    kind: api
    baseUrl: http://127.0.0.1:3003
    auth: { type: none }
  cms:
    kind: browser
    baseUrl: http://127.0.0.1:3004
    auth: { type: storage-state, file: .auth/storageState.json }
`;

describe("parseConfig", () => {
  it("parses targets", () => {
    const cfg = parseConfig(YAML);
    expect(Object.keys(cfg.targets)).toEqual(["api", "cms"]);
    expect(cfg.targets.api.kind).toBe("api");
  });

  it("resolveTarget throws on unknown target", () => {
    const cfg = parseConfig(YAML);
    expect(() => resolveTarget(cfg, "nope")).toThrow(/unknown target/i);
  });

  it("rejects target with missing baseUrl", () => {
    expect(() => parseConfig(`targets:\n  x:\n    kind: api\n    auth: { type: none }`)).toThrow(/baseUrl/);
  });
});
