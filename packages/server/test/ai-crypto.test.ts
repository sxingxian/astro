import { describe, expect, it } from "vitest";
import { decryptKey, encryptKey } from "../src/ai/crypto";

const MASTER = "0123456789abcdef".repeat(4);
const OTHER = "fedcba9876543210".repeat(4);
const KEY = "sk-ant-api03-very-secret-value-1234";

describe("AI key encryption", () => {
  it("round-trips a key bound to its row", async () => {
    const box = await encryptKey(MASTER, KEY, "row-1");
    expect(Buffer.from(box.ciphertext).toString("utf8")).not.toContain("secret");
    expect(await decryptKey(MASTER, box, "row-1")).toBe(KEY);
  });

  it("refuses a key moved to another row", async () => {
    const box = await encryptKey(MASTER, KEY, "row-1");
    await expect(decryptKey(MASTER, box, "row-2")).rejects.toThrow();
  });

  it("refuses another master key", async () => {
    const box = await encryptKey(MASTER, KEY, "row-1");
    await expect(decryptKey(OTHER, box, "row-1")).rejects.toThrow();
  });

  it("uses a fresh IV every time", async () => {
    const a = await encryptKey(MASTER, KEY, "row-1");
    const b = await encryptKey(MASTER, KEY, "row-1");
    expect(a.iv).toHaveLength(12);
    expect(Buffer.from(a.iv).equals(Buffer.from(b.iv))).toBe(false);
    expect(Buffer.from(a.ciphertext).equals(Buffer.from(b.ciphertext))).toBe(false);
  });

  it("rejects a malformed master key", async () => {
    await expect(encryptKey("abc", KEY, "row-1")).rejects.toThrow(/64 hex/);
  });
});
