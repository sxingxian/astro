import { randomBytes } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "../src/migrate";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const sql = postgres(url, { max: 1, onnotice: () => {} });

/** Runs `fn` as the app's database user, committed. */
async function asWeb<T>(fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
  return (await sql.begin(async (tx) => {
    await tx.unsafe("set local role astro_web");
    return fn(tx);
  })) as T;
}

/** Applies migrations up to and including `lastIdx`, from a trimmed copy of the folder. */
async function migrateTo(lastIdx: number) {
  const src = fileURLToPath(new URL("../migrations", import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), "astro-mig-"));
  cpSync(src, dir, { recursive: true });
  const journalPath = join(dir, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries: { idx: number }[] };
  journal.entries = journal.entries.filter((e) => e.idx <= lastIdx);
  writeFileSync(journalPath, JSON.stringify(journal));
  const client = postgres(url!, { max: 1, onnotice: () => {} });
  await migrate(drizzle(client), { migrationsFolder: dir });
  await client.end();
}

async function invite(email: string, role: "admin" | "moderator" | "reader", invitedBy: string, expires = "1 hour") {
  const hash = randomBytes(32);
  await sql`insert into invite (email, role, token_hash, invited_by, expires_at) values (${email}, ${role}, ${hash}, ${invitedBy}, now() + ${expires}::interval)`;
  return hash;
}
async function offer(userId: string, by: string, o: { reader: boolean; portal?: "admin" | "moderator" | null; expires?: string }) {
  const [row] = await sql<{ id: string }[]>`insert into role_offer (user_id, reader, portal_role, offered_by, expires_at)
    values (${userId}, ${o.reader}, ${o.portal ?? null}, ${by}, now() + ${o.expires ?? "1 hour"}::interval) returning id`;
  return row!.id;
}
async function person(id: string, twoStep = true) {
  await sql`insert into "user" (id, name, email, email_verified, two_factor_enabled) values (${id}, ${id}, ${id + "@example.com"}, true, ${twoStep})`;
}
const acceptInvite = (hash: Buffer, userId: string, guidelines = 0) =>
  asWeb(async (tx) => (await tx<{ r: string }[]>`select accept_invite(${hash}, ${userId}, ${guidelines}) as r`)[0]!.r);
const acceptOffer = (id: string, userId: string, guidelines = 0) =>
  asWeb(async (tx) => (await tx<{ r: string }[]>`select accept_role_offer(${id}::uuid, ${userId}, ${guidelines}) as r`)[0]!.r);
const activeReader = async (userId: string) =>
  (await sql<{ n: number }[]>`select count(*)::int as n from reader_role where user_id = ${userId} and revoked_at is null`)[0]!.n === 1;

beforeAll(async () => {
  await sql.unsafe(`do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'astro_web') then create role astro_web login password 'astro_web'; end if;
    if not exists (select 1 from pg_roles where rolname = 'astro_admin') then create role astro_admin login password 'astro_admin'; end if;
  end $$`);
  await sql.unsafe("drop schema if exists drizzle cascade; drop schema public cascade; create schema public;");
  await migrateTo(5);
  await person("u-owner");
  await person("u-admin");
  await person("u-mod");
  await person("u-old-reader");
  await sql`insert into staff_role (user_id, role) values ('u-owner', 'owner'), ('u-admin', 'admin'), ('u-mod', 'moderator')`;
  await sql`insert into staff_role (user_id, role, granted_by) values ('u-old-reader', 'reader', 'u-owner')`;
  await runMigrations(url);
});
afterAll(async () => {
  await sql.end();
});

describe("migration 0006", () => {
  it("moves existing readers out of staff_role into reader_role", async () => {
    expect(await activeReader("u-old-reader")).toBe(true);
    const [left] = await sql<{ n: number }[]>`select count(*)::int as n from staff_role where user_id = 'u-old-reader'`;
    expect(left!.n).toBe(0);
    await expect(sql`insert into staff_role (user_id, role) values ('u-old-reader', 'reader')`).rejects.toThrow(/check/i);
  });
});

describe("what the app's database user may do", () => {
  it("can't write role tables, but can run both accept functions", async () => {
    for (const q of [
      "insert into reader_role (user_id) values ('u-mod')",
      "insert into role_offer (user_id, reader, expires_at) values ('u-mod', true, now())",
      "insert into staff_role (user_id, role) values ('u-old-reader', 'admin')",
      "update reader_role set revoked_at = null"
    ]) {
      await expect(asWeb((tx) => tx.unsafe(q))).rejects.toThrow(/permission denied/i);
    }
    expect(await acceptInvite(randomBytes(32), "u-mod")).toBe("invalid");
    expect(await acceptOffer("00000000-0000-0000-0000-000000000000", "u-mod")).toBe("invalid");
  });
});

describe("during the switch to migration 0006", () => {
  it("keeps the previous app's accept_invite(bytea, text) working for portal roles, refusing reader invites", async () => {
    await person("u-switch");
    await person("u-switch-r");
    const portal = await invite("u-switch@example.com", "moderator", "u-owner");
    expect(await asWeb(async (tx) => (await tx<{ r: string }[]>`select accept_invite(${portal}, 'u-switch') as r`)[0]!.r)).toBe("ok:moderator");
    const reader = await invite("u-switch-r@example.com", "reader", "u-owner");
    expect(await asWeb(async (tx) => (await tx<{ r: string }[]>`select accept_invite(${reader}, 'u-switch-r') as r`)[0]!.r)).toBe("guidelines_changed");
    expect(await activeReader("u-switch-r")).toBe(false);
  });
});

describe("reader log table", () => {
  it("is out of the portal's reach entirely", async () => {
    await expect(
      sql.begin(async (tx) => {
        await tx.unsafe("set local role astro_admin");
        await tx`select count(*) from reader_log_entry`;
      })
    ).rejects.toThrow(/permission denied/i);
  });
});

describe("accept_invite with readers", () => {
  it("makes the person a reader and records the guidelines they accepted", async () => {
    await person("u-r1");
    expect(await acceptInvite(await invite("u-r1@example.com", "reader", "u-admin"), "u-r1", 0)).toBe("ok:reader");
    expect(await activeReader("u-r1")).toBe(true);
    const [acc] = await sql<{ version: string }[]>`select version from guideline_acceptance where user_id = 'u-r1'`;
    expect(Number(acc!.version)).toBe(0);
  });

  it("refuses when the guidelines changed since the person read them, writing nothing", async () => {
    await person("u-r2");
    const [v] = await sql<{ id: string }[]>`insert into text_version (kind, snapshot) values ('guidelines', '{}') returning id`;
    const hash = await invite("u-r2@example.com", "reader", "u-admin");
    expect(await acceptInvite(hash, "u-r2", 0)).toBe("guidelines_changed");
    expect(await activeReader("u-r2")).toBe(false);
    const [acc] = await sql<{ n: number }[]>`select count(*)::int as n from guideline_acceptance where user_id = 'u-r2'`;
    expect(acc!.n).toBe(0);
    expect(await acceptInvite(hash, "u-r2", Number(v!.id))).toBe("ok:reader");
  });

  it("only lets the owner give staff the reader role", async () => {
    const [v] = await sql<{ id: string }[]>`select coalesce(max(id), 0) as id from text_version where kind = 'guidelines'`;
    const g = Number(v!.id);
    expect(await acceptInvite(await invite("u-mod@example.com", "reader", "u-admin"), "u-mod", g)).toBe("staff_reader_owner_only");
    expect(await activeReader("u-mod")).toBe(false);
    expect(await acceptInvite(await invite("u-mod@example.com", "reader", "u-owner"), "u-mod", g)).toBe("ok:reader");
    expect(await activeReader("u-mod")).toBe(true);
    const [staff] = await sql<{ role: string }[]>`select role from staff_role where user_id = 'u-mod' and revoked_at is null`;
    expect(staff!.role).toBe("moderator");
  });

  it("lets a reader give the role up, and a later invite brings back the same row", async () => {
    const [v] = await sql<{ id: string }[]>`select coalesce(max(id), 0) as id from text_version where kind = 'guidelines'`;
    await person("u-r3");
    await acceptInvite(await invite("u-r3@example.com", "reader", "u-admin"), "u-r3", Number(v!.id));
    await asWeb((tx) => tx`select give_up_reader_role('u-r3')`);
    const [gone] = await sql<{ revoked_at: Date | null }[]>`select revoked_at from reader_role where user_id = 'u-r3'`;
    expect(gone!.revoked_at).not.toBeNull();
    expect(await acceptInvite(await invite("u-r3@example.com", "reader", "u-admin"), "u-r3", Number(v!.id))).toBe("ok:reader");
    const rows = await sql<{ revoked_at: Date | null }[]>`select revoked_at from reader_role where user_id = 'u-r3'`;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.revoked_at).toBeNull();
  });
});

describe("accept_role_offer", () => {
  let g = 0;
  beforeAll(async () => {
    const [v] = await sql<{ id: string }[]>`select coalesce(max(id), 0) as id from text_version where kind = 'guidelines'`;
    g = Number(v!.id);
    await person("u-o1");
    await person("u-o2");
    await person("u-nostep", false);
  });

  it("refuses another account's offer, an expired one, and one without 2-step sign-in", async () => {
    expect(await acceptOffer(await offer("u-o1", "u-admin", { reader: true }), "u-o2", g)).toBe("invalid");
    expect(await acceptOffer(await offer("u-o1", "u-admin", { reader: true, expires: "-1 minute" }), "u-o1", g)).toBe("expired");
    expect(await acceptOffer(await offer("u-nostep", "u-admin", { reader: true }), "u-nostep", g)).toBe("two_step_required");
    expect(await activeReader("u-o1")).toBe(false);
  });

  it("counts a portal role in the same offer as staff: only the owner may add the reader role to it", async () => {
    expect(await acceptOffer(await offer("u-o2", "u-admin", { reader: true, portal: "moderator" }), "u-o2", g)).toBe("staff_reader_owner_only");
    const [none] = await sql<{ n: number }[]>`select count(*)::int as n from staff_role where user_id = 'u-o2'`;
    expect(none!.n).toBe(0);
    const id = await offer("u-o2", "u-owner", { reader: true, portal: "moderator" });
    expect(await acceptOffer(id, "u-o2", g)).toBe("ok:moderator+reader");
    expect(await activeReader("u-o2")).toBe(true);
    const [staff] = await sql<{ role: string }[]>`select role from staff_role where user_id = 'u-o2'`;
    expect(staff!.role).toBe("moderator");
    expect(await acceptOffer(id, "u-o2", g)).toBe("invalid");
  });

  it("gives an ordinary account the reader role from an admin's offer", async () => {
    expect(await acceptOffer(await offer("u-o1", "u-admin", { reader: true }), "u-o1", g)).toBe("ok:reader");
    expect(await activeReader("u-o1")).toBe(true);
  });
});

describe("the sender's authority, checked when the role is accepted", () => {
  let g = 0;
  beforeAll(async () => {
    g = Number((await sql<{ id: string }[]>`select coalesce(max(id), 0) as id from text_version where kind = 'guidelines'`)[0]!.id);
    await person("u-x");
    await person("u-y");
    await person("u-z");
    await person("u-admin2");
    await sql`insert into staff_role (user_id, role) values ('u-admin2', 'admin')`;
  });

  it("won't let an admin make a reader staff afterwards, by offer or by invite; the owner can", async () => {
    expect(await acceptOffer(await offer("u-x", "u-admin", { reader: true }), "u-x", g)).toBe("ok:reader");
    expect(await acceptOffer(await offer("u-x", "u-admin", { reader: false, portal: "moderator" }), "u-x", g)).toBe("staff_reader_owner_only");
    expect(await acceptInvite(await invite("u-x@example.com", "moderator", "u-admin"), "u-x", g)).toBe("staff_reader_owner_only");
    const [none] = await sql<{ n: number }[]>`select count(*)::int as n from staff_role where user_id = 'u-x'`;
    expect(none!.n).toBe(0);
    expect(await acceptOffer(await offer("u-x", "u-owner", { reader: false, portal: "moderator" }), "u-x", g)).toBe("ok:moderator");
  });

  it("refuses an offer or invite whose sender has since lost their role, or no longer exists", async () => {
    const offerId = await offer("u-y", "u-admin2", { reader: false, portal: "moderator" });
    const inv = await invite("u-z@example.com", "moderator", "u-admin2");
    await sql`update staff_role set revoked_at = now() where user_id = 'u-admin2'`;
    expect(await acceptOffer(offerId, "u-y", g)).toBe("invalid");
    expect(await acceptInvite(inv, "u-z", g)).toBe("invalid");
    expect(await acceptOffer(await offer("u-y", null as unknown as string, { reader: true }), "u-y", g)).toBe("invalid");
    expect(await acceptInvite(await invite("u-y@example.com", "admin", "u-admin"), "u-y", g)).toBe("invalid");
  });
});
