import { createDb, schema } from "@astro/db";
import { resetAndMigrate } from "@astro/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setTimeZone, takePasswordAttempt } from "@astro/app-core/account";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const db = createDb(url);
const now = new Date("2026-11-26T04:00:00Z");

async function member(id: string) {
  await db.insert(schema.user).values({ id, name: id, email: `${id}@example.com`, emailVerified: true, timeZone: "Asia/Singapore" });
  return id;
}

beforeAll(async () => {
  await resetAndMigrate(url);
});
afterAll(async () => {
  await db.$client.end();
});

describe("setTimeZone", () => {
  it("allows one change a week, even under concurrent requests", async () => {
    const u = await member("tz-race");
    const results = await Promise.all(["Europe/London", "America/New_York", "Asia/Tokyo"].map((tz) => setTimeZone(db, u, tz, now)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.nextChange === "2026-12-03T04:00:00.000Z")).toBe(true);
    const later = await setTimeZone(db, u, "Europe/Paris", new Date(now.getTime() + 8 * 86_400_000));
    expect(later.ok).toBe(true);
  });

  it("rejects names that aren't timezones", async () => {
    const u = await member("tz-bad");
    await expect(setTimeZone(db, u, "Not/AZone", now)).rejects.toThrow(RangeError);
  });
});

describe("takePasswordAttempt", () => {
  it("allows 5 password checks per person per 15 minutes", async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 6; i++) results.push(await takePasswordAttempt(db, "pw-user", now));
    expect(results).toEqual([true, true, true, true, true, false]);
    expect(await takePasswordAttempt(db, "pw-other", now)).toBe(true);
    expect(await takePasswordAttempt(db, "pw-user", new Date(now.getTime() + 16 * 60_000))).toBe(true);
  });
});
