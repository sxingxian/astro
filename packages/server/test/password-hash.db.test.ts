import { createDb } from "@astro/db";
import { resetAndMigrate } from "@astro/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPasswordHasher, HASH_PREFIX } from "../src/password-hash";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const db = createDb(url);
const hasher = createPasswordHasher(db);

beforeAll(async () => {
  await resetAndMigrate(url);
});
afterAll(async () => {
  await db.$client.end();
});

describe("database password hashing", () => {
  it("stores bcrypt (cost 12) hashes and verifies them", async () => {
    const hash = await hasher.hash("correct horse battery staple");
    expect(hash.startsWith(HASH_PREFIX)).toBe(true);
    expect(hash.slice(HASH_PREFIX.length)).toMatch(/^\$2[aby]\$12\$/);
    expect(await hasher.verify({ hash, password: "correct horse battery staple" })).toBe(true);
    expect(await hasher.verify({ hash, password: "correct horse battery stapl" })).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hasher.hash("same password here")).not.toBe(await hasher.hash("same password here"));
  });

  it("counts every character of a long password (beyond bcrypt's 72-byte limit)", async () => {
    const base = "x".repeat(100);
    const hash = await hasher.hash(`${base}-one`);
    expect(await hasher.verify({ hash, password: `${base}-two` })).toBe(false);
    expect(await hasher.verify({ hash, password: `${base}-one` })).toBe(true);
  });

  it("rejects hashes it doesn't recognise", async () => {
    expect(await hasher.verify({ hash: "abcd:ef01", password: "anything at all" })).toBe(false);
    expect(await hasher.verify({ hash: `${HASH_PREFIX}not-bcrypt`, password: "anything at all" })).toBe(false);
  });

  it("keeps the Worker's own CPU time far under the Workers Free 10 ms limit", async () => {
    await hasher.hash("warm up the connection");
    const before = process.cpuUsage();
    const hash = await hasher.hash("correct horse battery staple");
    await hasher.verify({ hash, password: "correct horse battery staple" });
    const used = process.cpuUsage(before);
    expect((used.user + used.system) / 1000).toBeLessThan(10);
  });
});
