import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createCommitment, createSalt, fingerprintOf, formatFingerprint, verifyCommitment } from "../src/index";

describe("fingerprint", () => {
  it("is the first 16 hex chars of sha256(order.join(',') + ':' + salt)", async () => {
    const expected = createHash("sha256").update("a,b:00").digest("hex").slice(0, 16);
    expect(await fingerprintOf(["a", "b"], "00")).toBe(expected);
  });

  it("formats as four groups of four", () => {
    expect(formatFingerprint("a3f90c7e51bd92e4")).toBe("a3f9 0c7e 51bd 92e4");
  });

  it("creates 32-char lowercase hex salts", () => {
    expect(createSalt()).toMatch(/^[0-9a-f]{32}$/);
    expect(createSalt()).not.toBe(createSalt());
  });
});

describe("commitment", () => {
  it("verifies its own round trip", async () => {
    const c = await createCommitment(["x", "y", "z"]);
    expect(c.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(await verifyCommitment(c.order, c.salt, c.fingerprint)).toBe(true);
  });

  it("fails when the order, salt or fingerprint changes", async () => {
    const c = await createCommitment(["x", "y", "z"]);
    expect(await verifyCommitment(["y", "x", "z"], c.salt, c.fingerprint)).toBe(false);
    expect(await verifyCommitment(c.order, createSalt(), c.fingerprint)).toBe(false);
    expect(await verifyCommitment(c.order, c.salt, "0000000000000000")).toBe(false);
  });
});
