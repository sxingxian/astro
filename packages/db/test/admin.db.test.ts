import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetAndMigrate } from "./helpers";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const sql = postgres(url, { max: 1, onnotice: () => {} });

/** Runs `fn` as `role` inside a transaction that is always rolled back. */
async function as<T>(role: "astro_web" | "astro_admin" | "migrator", fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  let out: T | undefined;
  await sql
    .begin(async (tx) => {
      if (role !== "migrator") await tx.unsafe(`set local role ${role}`);
      out = await fn(tx);
      throw new Rollback();
    })
    .catch((e: unknown) => {
      if (!(e instanceof Rollback)) throw e;
    });
  return out as T;
}
class Rollback extends Error {}

beforeAll(async () => {
  await sql.unsafe(`do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'astro_web') then create role astro_web login password 'astro_web'; end if;
    if not exists (select 1 from pg_roles where rolname = 'astro_admin') then create role astro_admin login password 'astro_admin'; end if;
  end $$`);
  await resetAndMigrate(url);
  await sql`insert into "user" (id, name, email, email_verified) values ('u-owner', 'Owner', 'owner@example.com', true), ('u-two', 'Two', 'two@example.com', true)`;
});
afterAll(async () => {
  await sql.end();
});

describe("admin portal tables", () => {
  it("allows exactly one active owner", async () => {
    await sql`insert into staff_role (user_id, role) values ('u-owner', 'owner')`;
    await expect(sql`insert into staff_role (user_id, role) values ('u-two', 'owner')`).rejects.toThrow(/unique|duplicate/i);
    await sql`insert into staff_role (user_id, role) values ('u-two', 'moderator')`;
  });

  it("keeps the audit log append-only", async () => {
    await sql`insert into audit_log (actor_id, actor_role, action, entity, summary) values ('u-owner', 'owner', 'auth.sign_in', 'session', '{}')`;
    await expect(as("astro_admin", (tx) => tx`update audit_log set action = 'x'`)).rejects.toThrow(/permission denied/i);
    await expect(as("astro_web", (tx) => tx`delete from audit_log`)).rejects.toThrow(/permission denied/i);
    await expect(sql`delete from audit_log`).rejects.toThrow(/append-only/i);
    await expect(sql`update audit_log set action = 'x'`).rejects.toThrow(/append-only/i);
    await as("astro_admin", (tx) => tx`insert into audit_log (actor_id, actor_role, action, entity, summary) values ('u-owner', 'owner', 'x', 'y', '{}')`);
  });

  it("lets astro_admin count check-ins without reading their notes", async () => {
    await as("astro_admin", (tx) => tx`select count(*) from check_in`);
    await as("astro_admin", (tx) => tx`select outcome from check_in`);
  });

  it("gives astro_admin no DDL", async () => {
    await expect(as("astro_admin", (tx) => tx`create table nope (id int)`)).rejects.toThrow(/permission denied/i);
  });

  it("lets astro_web read AI service metadata but never change it", async () => {
    await as("astro_web", (tx) => tx`select key_last4 from ai_service`);
    await expect(as("astro_web", (tx) => tx`update ai_service set model = 'x'`)).rejects.toThrow(/permission denied/i);
  });

  it("lets astro_admin disable a user but not change their email, and never read private notes", async () => {
    await as("astro_admin", (tx) => tx`update "user" set disabled_at = now() where id = 'u-two'`);
    await expect(as("astro_admin", (tx) => tx`update "user" set email = 'x@example.com' where id = 'u-two'`)).rejects.toThrow(/permission denied/i);
    await expect(as("astro_admin", (tx) => tx`select body from reading_note`)).rejects.toThrow(/permission denied/i);
    await expect(as("astro_admin", (tx) => tx`select note from check_in`)).rejects.toThrow(/permission denied/i);
  });

  it("never lets astro_web grant a role or read invites; it can only accept one through accept_invite", async () => {
    await expect(as("astro_web", (tx) => tx`insert into staff_role (user_id, role) values ('x', 'admin')`)).rejects.toThrow(/permission denied/i);
    await expect(as("astro_web", (tx) => tx`select token_hash from invite`)).rejects.toThrow(/permission denied/i);
    await expect(as("astro_web", (tx) => tx`update invite set accepted_at = now()`)).rejects.toThrow(/permission denied/i);
    const [r] = await as("astro_web", (tx) => tx<{ r: string }[]>`select accept_invite(${Buffer.alloc(32)}, 'nobody') as r`);
    expect(r?.r).toBe("invalid");
  });

  it("gives astro_admin no way to create accounts, overwrite passwords or read people's cards", async () => {
    await expect(as("astro_admin", (tx) => tx`insert into "user" (id, name, email) values ('z', 'z', 'z@example.com')`)).rejects.toThrow(/permission denied/i);
    await expect(as("astro_admin", (tx) => tx`update account set password = 'x'`)).rejects.toThrow(/permission denied/i);
    await expect(as("astro_admin", (tx) => tx`select time_zone from draw_session`)).rejects.toThrow(/permission denied/i);
    await as("astro_admin", (tx) => tx`select count(*) from draw_session where status = 'complete'`);
  });

  it("marks new sessions as app sessions by default", async () => {
    await sql`insert into session (id, expires_at, token, user_id) values ('s1', now() + interval '1 day', 't1', 'u-owner')`;
    const [row] = await sql<{ surface: string }[]>`select surface from session where id = 's1'`;
    expect(row?.surface).toBe("app");
  });

  it("seeds the portal's settings", async () => {
    const rows = await sql<{ key: string }[]>`select key from app_setting order by key`;
    expect(rows.map((r) => r.key)).toEqual(expect.arrayContaining(["ai_daily_cap_usd", "ai_per_person_per_day", "maintenance_mode", "reversal_rate"]));
  });
});
