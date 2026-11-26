import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "../src/migrate";

// A database set up like Neon's: a non-superuser owner creates migrator (step 4 of docs/DEPLOYMENT.md), and the
// public schema already holds a table someone else made (Neon's "playing_with_neon" sample, for example).
const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error("grants test only runs against a local database");

const DB = "astro_grants_test";
const admin = postgres(url, { max: 1, onnotice: () => {} });
const at = (user: string, password: string) => {
  const u = new URL(url);
  u.username = user;
  u.password = password;
  u.pathname = `/${DB}`;
  return u.toString();
};

beforeAll(async () => {
  await admin.unsafe(`drop database if exists ${DB}`);
  await admin.unsafe("drop role if exists grants_owner; drop role if exists grants_migrator");
  await admin.unsafe("create role grants_owner login password 'Owner123' createrole");
  await admin.unsafe(`create database ${DB} owner grants_owner`);
  const asRoot = postgres(at(new URL(url).username, decodeURIComponent(new URL(url).password)), { max: 1, onnotice: () => {} });
  await asRoot.unsafe("create extension if not exists pgcrypto");
  await asRoot.end();
  const owner = postgres(at("grants_owner", "Owner123"), { max: 1, onnotice: () => {} });
  await owner.unsafe(`create role grants_migrator login password 'Mig123';
    grant all on schema public to grants_migrator;
    grant create on database ${DB} to grants_migrator;
    create table playing_with_neon (id serial primary key, name text);`);
  await owner.end();
}, 30_000);

afterAll(async () => {
  await admin.unsafe(`drop database if exists ${DB} with (force)`);
  await admin.unsafe("drop role if exists grants_migrator; drop role if exists grants_owner");
  await admin.end();
});

describe("runtime grants on a Neon-style database", () => {
  it("migrates even when public holds a table owned by someone else", async () => {
    await expect(runMigrations(at("grants_migrator", "Mig123"))).resolves.toBeGreaterThan(0);
  }, 30_000);

  it("gives astro_web the app's tables, and nothing it doesn't own", async () => {
    const db = postgres(at("grants_owner", "Owner123"), { max: 1, onnotice: () => {} });
    const [row] = await db<{ app: boolean; limits: boolean; other: boolean }[]>`
      select has_table_privilege('astro_web', 'public.draw_session', 'SELECT, INSERT, UPDATE, DELETE') as app,
             has_table_privilege('astro_web', 'public.rate_limit', 'SELECT, INSERT, UPDATE, DELETE') as limits,
             has_table_privilege('astro_web', 'public.playing_with_neon', 'SELECT') as other`;
    await db.end();
    expect(row).toEqual({ app: true, limits: true, other: false });
  });
});
