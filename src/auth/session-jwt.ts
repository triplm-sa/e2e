import jwt from "jsonwebtoken";

export interface MintArgs {
  apiKey: string;
  apiSecret: string;
  shop: string;
}

/**
 * Create a valid Shopify App Bridge session token exactly as Shopify does:
 * HS256, signed with the app secret, aud = apiKey, dest/iss containing the shop domain.
 * Matches b2bridge-tax-api/src/middleware/verify.ts (jwt.verify(token, apiSecret, {audience: apiKey})).
 */
export function mintSessionToken({ apiKey, apiSecret, shop }: MintArgs): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: `https://${shop}/admin`,
      dest: `https://${shop}`,
      aud: apiKey,
      sub: "1",
      exp: now + 60,
      nbf: now - 5,
      iat: now,
    },
    apiSecret,
    { algorithm: "HS256" },
  );
}
