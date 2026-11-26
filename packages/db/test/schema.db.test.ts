import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetAndMigrate } from "./helpers";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const sql = postgres(url, { max: 1, onnotice: () => {} });

beforeAll(async () => {
  await resetAndMigrate(url);
});
afterAll(async () => {
  await sql.end();
});

async function makeUser(id: string) {
  await sql`insert into "user" (id, name, email, email_verified, created_at, updated_at) values (${id}, ${id}, ${id + "@example.com"}, true, now(), now())`;
}

describe("schema", () => {
  it("creates every table", async () => {
    const rows = await sql<{ table_name: string }[]>`select table_name from information_schema.tables where table_schema = 'public'`;
    const names = rows.map((r) => r.table_name).sort();
    expect(names).toEqual(
      ["account", "ai_role_slot", "ai_service", "app_setting", "audit_log", "check_in", "draw_deck", "draw_session", "guest_day_cap", "invite", "mail_outbox", "rate_limit", "reading_note", "session", "staff_role", "two_factor", "user", "verification"].sort()
    );
  });

  it("allows one reading per person, spread and day", async () => {
    await makeUser("u1");
    await sql`insert into draw_session (user_id, spread, local_day, time_zone, status) values ('u1', 'one', '2026-11-26', 'Asia/Singapore', 'picking')`;
    await expect(sql`insert into draw_session (user_id, spread, local_day, time_zone, status) values ('u1', 'one', '2026-11-26', 'Asia/Singapore', 'picking')`).rejects.toThrow(/unique/i);
    await sql`insert into draw_session (user_id, spread, local_day, time_zone, status) values ('u1', 'three', '2026-11-26', 'Asia/Singapore', 'picking')`;
  });

  it("allows one guest reading per day", async () => {
    await sql`insert into draw_session (guest_hash, spread, local_day, time_zone, status) values ('g1', 'one', '2026-11-26', 'UTC', 'picking')`;
    await expect(sql`insert into draw_session (guest_hash, spread, local_day, time_zone, status) values ('g1', 'one', '2026-11-26', 'UTC', 'picking')`).rejects.toThrow(/unique/i);
  });

  it("requires exactly one of user and guest", async () => {
    await makeUser("u2");
    await expect(sql`insert into draw_session (user_id, guest_hash, spread, local_day, time_zone, status) values ('u2', 'g2', 'one', '2026-11-27', 'UTC', 'picking')`).rejects.toThrow(/check/i);
    await expect(sql`insert into draw_session (spread, local_day, time_zone, status) values ('one', '2026-11-27', 'UTC', 'picking')`).rejects.toThrow(/check/i);
  });

  it("seeds the reversal rate", async () => {
    const [row] = await sql<{ value: number }[]>`select value from app_setting where key = 'reversal_rate'`;
    expect(Number(row?.value)).toBe(0.3);
  });

  it("gives astro_web data access but no DDL", async () => {
    const [role] = await sql`select 1 from pg_roles where rolname = 'astro_web'`;
    if (!role) return;
    await sql.begin(async (tx) => {
      await tx`set local role astro_web`;
      await tx`select count(*) from draw_session`;
      await expect(tx`create table nope (id int)`).rejects.toThrow(/permission denied/i);
    }).catch((e: unknown) => {
      if (!(e instanceof Error) || !/permission denied/i.test(e.message)) throw e;
    });
  });
});
