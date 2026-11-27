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
