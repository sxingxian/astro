import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/** Either client: postgres.js over TCP (Hyperdrive) or Neon's driver over HTTPS (`@astro/db/http`). */
export type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>;

/** The rows of an `execute()` result from either client: postgres.js returns an array, Neon `{ rows }`. */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown } | null | undefined)?.rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

type Runnable = PromiseLike<unknown>;

/**
 * Runs several independent queries in as few round trips as the client allows: one HTTPS request on Neon's driver
 * (`db.batch`), in parallel on postgres.js. Results come back in order; read raw `execute()` results with `rowsOf`.
 */
export async function runBatch<T extends readonly Runnable[]>(db: AnyDb, queries: T): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  const batch = (db as unknown as { batch?: (q: readonly unknown[]) => Promise<unknown[]> }).batch;
  if (typeof batch === "function" && queries.length) return (await batch.call(db, queries)) as { [K in keyof T]: Awaited<T[K]> };
  return (await Promise.all(queries)) as { [K in keyof T]: Awaited<T[K]> };
}

/**
 * Runs queries that depend on each other, in order: one HTTPS request on Neon's driver (a batch runs in order, in one
 * transaction), one after another on postgres.js. Results come back in order.
 */
export async function runInOrder<T extends readonly Runnable[]>(db: AnyDb, queries: T): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  const batch = (db as unknown as { batch?: (q: readonly unknown[]) => Promise<unknown[]> }).batch;
  if (typeof batch === "function" && queries.length) return (await batch.call(db, queries)) as { [K in keyof T]: Awaited<T[K]> };
  const out: unknown[] = [];
  for (const q of queries) out.push(await q);
  return out as { [K in keyof T]: Awaited<T[K]> };
}
