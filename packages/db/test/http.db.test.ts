import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHttpDb } from "../src/http";
import { createDb, rowsOf, sql } from "../src/index";
import { neonFetchOverPostgres, resetAndMigrate } from "../src/testing";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const webUrl = url.replace("migrator:migrator", "astro_web:astro_web");

const tcp = createDb(webUrl);
const fake = neonFetchOverPostgres(webUrl);
const http = createHttpDb(webUrl, { fetch: fake.fetch });

beforeAll(async () => {
  await resetAndMigrate(url);
});
afterAll(async () => {
  await tcp.$client.end({ timeout: 1 });
  await fake.end();
});

const probe = sql`select 'tarot'::text as t, 42::int as n, true as b, null::text as nothing,
  '2026-11-27T10:00:00Z'::timestamptz as at, '{"a":[1,2]}'::jsonb as j, 7::bigint as big, 1.5::numeric as num`;

describe("HTTPS (Neon) client", () => {
  it("returns the same values as the postgres.js client for common types", async () => {
    const a = rowsOf<Record<string, unknown>>(await tcp.execute(probe));
    const b = rowsOf<Record<string, unknown>>(await http.execute(probe));
    expect(b).toEqual(a);
    expect(b[0]).toMatchObject({ t: "tarot", n: 42, b: true, nothing: null, j: { a: [1, 2] } });
  });

  it("runs Drizzle's query builder: insert then read back", async () => {
    const key = `http-test-${Date.now()}`;
    await http.execute(sql`insert into rate_limit (id, key, count, last_request) values (${key}, ${key}, 3, ${Date.now()})`);
    const rows = rowsOf<{ count: number }>(await http.execute(sql`select count from rate_limit where key = ${key}`));
    expect(rows).toEqual([{ count: 3 }]);
  });

  it("reports database errors with Postgres's message", async () => {
    await expect(http.execute(sql`select * from no_such_table`)).rejects.toThrow(/no_such_table/);
  });

  it("counts the requests it answers, so tests can prove a path made no database call", async () => {
    const before = fake.calls();
    await http.execute(sql`select 1`);
    expect(fake.calls()).toBe(before + 1);
  });
});

describe("rowsOf", () => {
  it("reads postgres.js arrays and node-postgres style { rows } alike", () => {
    expect(rowsOf([{ a: 1 }])).toEqual([{ a: 1 }]);
    expect(rowsOf({ rows: [{ a: 1 }] })).toEqual([{ a: 1 }]);
    expect(rowsOf(undefined)).toEqual([]);
  });
});

describe("runBatch", () => {
  it("runs several queries in one HTTPS request on Neon's driver, and in parallel on postgres.js", async () => {
    const { runBatch } = await import("../src/index");
    const before = fake.calls();
    const [a, b] = await runBatch(http, [http.execute(sql`select 1 as one`), http.execute(sql`select 2 as two`)] as const);
    expect(fake.calls()).toBe(before + 1);
    expect(rowsOf(a)).toEqual([{ one: 1 }]);
    expect(rowsOf(b)).toEqual([{ two: 2 }]);
    const [c, d] = await runBatch(tcp, [tcp.execute(sql`select 1 as one`), tcp.execute(sql`select 2 as two`)] as const);
    expect(rowsOf(c)).toEqual([{ one: 1 }]);
    expect(rowsOf(d)).toEqual([{ two: 2 }]);
  });
});

describe("runInOrder", () => {
  it("runs dependent queries in order: one HTTPS request (a transaction) on Neon's driver, one after another on postgres.js", async () => {
    const { runInOrder } = await import("../src/index");
    for (const db of [http, tcp]) {
      const key = `order-${Math.random()}`;
      await tcp.execute(sql`delete from app_setting where key = ${key}`);
      const before = fake.calls();
      const [, seen] = await runInOrder(db, [db.execute(sql`insert into app_setting (key, value) values (${key}, '1'::jsonb)`), db.execute(sql`select count(*)::int as n from app_setting where key = ${key}`)] as const);
      expect(rowsOf(seen)).toEqual([{ n: 1 }]);
      if (db === http) expect(fake.calls()).toBe(before + 1);
      await tcp.execute(sql`delete from app_setting where key = ${key}`);
    }
  });
});

describe("createHttpDb", () => {
  it("doesn't build Drizzle's relational metadata (unused; it cost ~2 ms of a fresh Worker's first request)", () => {
    expect(Object.keys((http as unknown as { query: object }).query)).toEqual([]);
  });
});

