import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rowsOf, sql } from "../src/index";
import { neonWsOverPostgres, resetAndMigrate } from "../src/testing";
import { createWsDb } from "../src/ws";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const webUrl = url.replace("migrator:migrator", "astro_web:astro_web");
let proxy: Awaited<ReturnType<typeof neonWsOverPostgres>>;

beforeAll(async () => {
  await resetAndMigrate(url);
  proxy = await neonWsOverPostgres();
});
afterAll(async () => {
  await proxy.close();
});

const client = () => createWsDb(webUrl, { wsProxy: proxy.address });

describe("WebSocket (Neon) client", () => {
  it("commits a transaction", async () => {
    const c = client();
    const key = `ws-commit-${Date.now()}`;
    await c.db.transaction(async (tx) => {
      await tx.execute(sql`insert into rate_limit (id, key, count, last_request) values (${key}, ${key}, 1, ${Date.now()})`);
    });
    expect(rowsOf(await c.db.execute(sql`select count from rate_limit where key = ${key}`))).toEqual([{ count: 1 }]);
    await c.end();
  });

  it("rolls back when the transaction throws", async () => {
    const c = client();
    const key = `ws-rollback-${Date.now()}`;
    await expect(
      c.db.transaction(async (tx) => {
        await tx.execute(sql`insert into rate_limit (id, key, count, last_request) values (${key}, ${key}, 1, ${Date.now()})`);
        throw new Error("stop");
      })
    ).rejects.toThrow("stop");
    expect(rowsOf(await c.db.execute(sql`select count from rate_limit where key = ${key}`))).toEqual([]);
    await c.end();
  });

  it("holds an advisory lock until the transaction ends", async () => {
    const a = client();
    const b = client();
    const order: string[] = [];
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    const first = a.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('ws-lock-test'))`);
      order.push("a locked");
      await held;
      order.push("a done");
    });
    await new Promise((r) => setTimeout(r, 200));
    const second = b.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('ws-lock-test'))`);
      order.push("b locked");
    });
    await new Promise((r) => setTimeout(r, 300));
    release();
    await Promise.all([first, second]);
    expect(order).toEqual(["a locked", "a done", "b locked"]);
    await a.end();
    await b.end();
  });
});
