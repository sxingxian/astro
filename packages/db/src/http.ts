import { neon, neonConfig } from "@neondatabase/serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/** Either client: postgres.js over TCP (Hyperdrive) or Neon's driver over HTTPS. */
export type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * A Drizzle client on Neon's HTTPS driver: each query is one HTTPS request, with no connection to open or log in
 * to on the Worker. No open-ended transactions: use a Postgres function for anything that must be all-or-nothing.
 * `fetch` is for tests (see `neonFetchOverPostgres`); it is set for the process, as the driver allows.
 */
export function createHttpDb(connectionString: string, opts: { fetch?: typeof fetch } = {}): AnyDb {
  if (opts.fetch) neonConfig.fetchFunction = opts.fetch;
  return drizzle({ client: neon(connectionString), schema }) as unknown as AnyDb;
}

/** The rows of an `execute()` result from either client: postgres.js returns an array, Neon `{ rows }`. */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown } | null | undefined)?.rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}
