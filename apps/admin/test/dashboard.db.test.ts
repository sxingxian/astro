import { createDb } from "@astro/db";
import { resetAndMigrate } from "@astro/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDashboard } from "@/lib/dashboard";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const db = createDb(url);
const now = new Date("2026-11-27T12:00:00Z");

beforeAll(async () => {
  await resetAndMigrate(url);
  await db.$client`insert into "user" (id, name, email, email_verified, two_factor_enabled, created_at) values
    ('u1', 'a', 'a@example.com', true, true, '2026-11-27T01:00:00Z'),
    ('u2', 'b', 'b@example.com', true, false, '2026-11-24T01:00:00Z'),
    ('u3', 'c', 'c@example.com', true, false, '2026-11-01T01:00:00Z')`;
  await db.$client`insert into draw_session (id, user_id, spread, local_day, time_zone, status, created_at, completed_at) values
    ('00000000-0000-0000-0000-000000000001', 'u1', 'one',   '2026-11-27', 'UTC', 'complete', '2026-11-27T02:00:00Z', '2026-11-27T02:01:00Z'),
    ('00000000-0000-0000-0000-000000000002', 'u1', 'three', '2026-11-27', 'UTC', 'complete', '2026-11-27T03:00:00Z', '2026-11-27T03:05:00Z'),
    ('00000000-0000-0000-0000-000000000003', 'u2', 'one',   '2026-11-25', 'UTC', 'complete', '2026-11-25T02:00:00Z', '2026-11-25T02:01:00Z'),
    ('00000000-0000-0000-0000-000000000004', 'u2', 'one',   '2026-11-27', 'UTC', 'picking',  '2026-11-27T04:00:00Z', null),
    ('00000000-0000-0000-0000-000000000005', 'u3', 'one',   '2026-11-10', 'UTC', 'complete', '2026-11-10T02:00:00Z', '2026-11-10T02:01:00Z')`;
  await db.$client`insert into check_in (session_id, outcome, note, created_at) values
    ('00000000-0000-0000-0000-000000000003', 'fit', 'private', '2026-11-26T02:00:00Z'),
    ('00000000-0000-0000-0000-000000000005', 'skipped', null, '2026-11-26T03:00:00Z')`;
});
afterAll(async () => {
  await db.$client.end();
});

describe("getDashboard", () => {
  it("counts today (UTC) from aggregates", async () => {
    const d = await getDashboard(db, "today", now);
    expect(d).toEqual({ readings: 2, readingsOne: 1, readingsThree: 1, signUps: 1, signUpsTwoStep: 1, activePeople: 2, checkInsAnswered: 0 });
  });

  it("counts the last 7 days, and skipped check-ins aren't answers", async () => {
    const d = await getDashboard(db, "7d", now);
    expect(d).toEqual({ readings: 3, readingsOne: 2, readingsThree: 1, signUps: 2, signUpsTwoStep: 1, activePeople: 2, checkInsAnswered: 1 });
  });
});
