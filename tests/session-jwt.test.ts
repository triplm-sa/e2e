import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { mintSessionToken } from "../src/auth/session-jwt.js";

const SECRET = "s".repeat(64);
const API_KEY = "test-api-key";
const SHOP = "demo.myshopify.com";

describe("mintSessionToken", () => {
  it("mints a token the API's verify() would accept", () => {
    const token = mintSessionToken({ apiKey: API_KEY, apiSecret: SECRET, shop: SHOP });
    const payload: any = jwt.verify(token, SECRET, { audience: API_KEY });
    expect(payload.dest).toBe(`https://${SHOP}`);
    const shop = String(payload.dest).replace(/^https?:\/\//, "").replace(/\/admin.*$/, "");
    expect(shop).toBe(SHOP);
  });

  it("produces a token that fails verification with the wrong secret", () => {
    const token = mintSessionToken({ apiKey: API_KEY, apiSecret: SECRET, shop: SHOP });
    expect(() => jwt.verify(token, "wrong", { audience: API_KEY })).toThrow();
  });
});
