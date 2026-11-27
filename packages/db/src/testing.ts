import postgres from "postgres";
import { runMigrations } from "./migrate";

/** Tests only: drops everything in the given database and applies every migration from scratch. */
export async function resetAndMigrate(url: string): Promise<void> {
  if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error("resetAndMigrate only runs against a local database");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe("drop schema if exists drizzle cascade; drop schema public cascade; create schema public;");
  await sql.end();
  await runMigrations(url);
}

/**
 * Tests only: a `fetch` that answers Neon's SQL-over-HTTP requests from a local Postgres, so the real Neon HTTPS
 * driver runs in tests. Values go back as text with their type ids, as Neon sends them; the driver parses them.
 */
export function neonFetchOverPostgres(url: string): { fetch: typeof fetch; calls: () => number; end: () => Promise<void> } {
  if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error("neonFetchOverPostgres only runs against a local database");
  const sql = postgres(url, { max: 1, onnotice: () => {}, fetch_types: false });
  let calls = 0;
  type Q = { query: string; params: unknown[] };
  const run = async ({ query, params }: Q) => {
    const result = await sql.unsafe(query, params as never[]).raw();
    const cols = result.columns ?? [];
    return {
      fields: cols.map((c) => ({ name: c.name, dataTypeID: c.type })),
      rows: result.map((row) => (row as unknown as (Buffer | null)[]).map((v) => (v === null ? null : v.toString("utf8")))),
      command: result.command,
      rowCount: result.count ?? result.length
    };
  };
  const fake = (async (_input: unknown, init?: { body?: unknown }) => {
    calls++;
    const body = JSON.parse(String(init?.body ?? "{}")) as Q | { queries: Q[] };
    try {
      const out = "queries" in body ? { results: await Promise.all(body.queries.map(run)) } : await run(body);
      return new Response(JSON.stringify(out), { status: 200, headers: { "content-type": "application/json" } });
    } catch (e) {
      const err = e as { message?: string; code?: string };
      return new Response(JSON.stringify({ message: err.message ?? String(e), code: err.code }), { status: 400 });
    }
  }) as unknown as typeof fetch;
  return { fetch: fake, calls: () => calls, end: () => sql.end({ timeout: 1 }) };
}
