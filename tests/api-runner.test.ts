import { describe, it, expect } from "vitest";
import { interpolate } from "../src/api-runner.js";

const vars = { id: 7, token: "abc", flag: true, obj: { a: 1 } };

describe("interpolate", () => {
  it("substitutes a variable inside a longer string as text", () => {
    expect(interpolate("/orders/${id}/items", vars)).toBe("/orders/7/items");
  });

  it("preserves the original type when the string is exactly one variable", () => {
    expect(interpolate("${id}", vars)).toBe(7);
    expect(interpolate("${flag}", vars)).toBe(true);
    expect(interpolate("${obj}", vars)).toEqual({ a: 1 });
  });

  it("walks nested objects and arrays", () => {
    expect(interpolate({ h: { Authorization: "Bearer ${token}" }, ids: ["${id}", "x-${id}"] }, vars))
      .toEqual({ h: { Authorization: "Bearer abc" }, ids: [7, "x-7"] });
  });

  it("leaves an unknown variable untouched so the failure is visible", () => {
    expect(interpolate("${nope}", vars)).toBe("${nope}");
    expect(interpolate("/a/${nope}/b", vars)).toBe("/a/${nope}/b");
  });

  it("passes non-string primitives through unchanged", () => {
    expect(interpolate(42, vars)).toBe(42);
    expect(interpolate(null, vars)).toBe(null);
  });
});
