import { describe, expect, it } from "vitest";
import { verifyTotp } from "../src/totp";

// RFC 6238 appendix B: the SHA-1 key is the ASCII string "12345678901234567890".
const key = new TextEncoder().encode("12345678901234567890");

describe("verifyTotp", () => {
  it("matches the RFC 6238 SHA-1 test vector (6 digits)", async () => {
    // 59 s is time step 1; the 8-digit code is 94287082, so the 6-digit code is 287082.
    expect(await verifyTotp(key, "287082", new Date(59_000))).toBe(1);
  });

  it("accepts one step either side and nothing further", async () => {
    expect(await verifyTotp(key, "287082", new Date(29_000))).toBe(1);
    expect(await verifyTotp(key, "287082", new Date(89_000))).toBe(1);
    expect(await verifyTotp(key, "287082", new Date(119_000))).toBeNull();
  });

  it("rejects anything that isn't six digits", async () => {
    expect(await verifyTotp(key, "28708a", new Date(59_000))).toBeNull();
    expect(await verifyTotp(key, "28708", new Date(59_000))).toBeNull();
    expect(await verifyTotp(key, "2870822", new Date(59_000))).toBeNull();
  });
});
