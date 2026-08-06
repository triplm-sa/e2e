import { describe, it, expect } from "vitest";
import { getPath, evalExpect } from "../src/assert.js";

describe("getPath", () => {
  it("reads a nested key by dot-path", () => {
    expect(getPath({ rule: { name: "VN" } }, "rule.name")).toBe("VN");
    expect(getPath({ a: [{ b: 1 }] }, "a.0.b")).toBe(1);
  });
});

describe("evalExpect", () => {
  it("passes when both status and bodyMatch match", () => {
    const r = evalExpect({ status: 200, bodyMatch: { "rule.name": "VN" } }, 200, { rule: { name: "VN" } });
    expect(r.passed).toBe(true);
  });
  it("fails on a status mismatch", () => {
    const r = evalExpect({ status: 200 }, 404, {});
    expect(r.passed).toBe(false);
    expect(r.detail).toMatch(/status/);
  });
  it("fails when bodyMatch does not match", () => {
    const r = evalExpect({ bodyMatch: { "rule.name": "VN" } }, 200, { rule: { name: "US" } });
    expect(r.passed).toBe(false);
  });
});
