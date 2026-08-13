import { describe, expect, it } from "vitest";
import { validateCaseFile } from "../src/validation.js";

describe("validateCaseFile", () => {
  it("accepts a valid API case file", () => {
    const result = validateCaseFile({ id: "TD-55", feature: "Tax display", targets: ["api"], steps: [{ case: "TD-01", target: "api", phase: "setup", request: { method: "POST", path: "/seed" }, expect: { status: 201 } }] });
    expect(result.id).toBe("TD-55");
    expect(result.steps).toHaveLength(1);
  });

  it("rejects malformed steps before execution", () => {
    expect(() => validateCaseFile({ id: "TD-55", feature: "Tax display", targets: ["api"], steps: [{ target: "api" }] })).toThrow(/request \(API step\) or action/);
  });

  it("rejects invalid phases", () => {
    expect(() => validateCaseFile({ id: "TD-55", feature: "Tax display", targets: ["api"], steps: [{ target: "api", phase: "wat", request: { method: "POST", path: "/x" }, expect: {} }] })).toThrow(/phase.*setup\|test\|teardown/);
  });

  it("rejects invalid HTTP methods", () => {
    expect(() => validateCaseFile({ id: "TD-55", feature: "Tax display", targets: ["api"], steps: [{ target: "api", request: { method: "NOPE", path: "/x" }, expect: {} }] })).toThrow(/unsupported HTTP method/);
  });
});
