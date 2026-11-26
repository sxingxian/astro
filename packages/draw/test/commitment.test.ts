import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createCommitment, createSalt, fingerprintOf, formatFingerprint, verifyCommitment, type Orientation } from "../src/index";

const up: Orientation = "upright";
const rev: Orientation = "reversed";

describe("fingerprint", () => {
  it("is the first 32 hex chars of sha256(order + '|' + orientations + ':' + salt)", async () => {
    const expected = createHash("sha256").update("a,b|upright,reversed:00").digest("hex").slice(0, 32);
    expect(await fingerprintOf(["a", "b"], [up, rev], "00")).toBe(expected);
  });

  it("rejects orientations that do not match the order length", async () => {
    await expect(fingerprintOf(["a", "b"], [up], "00")).rejects.toThrow(RangeError);
  });

  it("formats as eight groups of four", () => {
    expect(formatFingerprint("0123456789abcdef0123456789abcdef")).toBe("0123 4567 89ab cdef 0123 4567 89ab cdef");
  });

  it("creates 32-char lowercase hex salts", () => {
    expect(createSalt()).toMatch(/^[0-9a-f]{32}$/);
    expect(createSalt()).not.toBe(createSalt());
  });
});

describe("commitment", () => {
  it("verifies its own round trip", async () => {
    const c = await createCommitment(["x", "y", "z"], [up, rev, up]);
    expect(c.fingerprint).toMatch(/^[0-9a-f]{32}$/);
    expect(c.orientations).toEqual([up, rev, up]);
    expect(await verifyCommitment(c.order, c.orientations, c.salt, c.fingerprint)).toBe(true);
  });

  it("fails when the order, salt or fingerprint changes", async () => {
    const c = await createCommitment(["x", "y", "z"], [up, up, up]);
    expect(await verifyCommitment(["y", "x", "z"], c.orientations, c.salt, c.fingerprint)).toBe(false);
    expect(await verifyCommitment(c.order, c.orientations, createSalt(), c.fingerprint)).toBe(false);
    expect(await verifyCommitment(c.order, c.orientations, c.salt, "00000000000000000000000000000000")).toBe(false);
  });

  it("fails when a card is flipped after the commitment", async () => {
    const c = await createCommitment(["x", "y", "z"], [up, up, up]);
    expect(await verifyCommitment(c.order, [up, rev, up], c.salt, c.fingerprint)).toBe(false);
  });
});
