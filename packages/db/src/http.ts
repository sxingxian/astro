import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { AnyDb } from "./rows";
import * as schema from "./schema";

export type { AnyDb };

/**
 * A Drizzle client on Neon's HTTPS driver: each query is one HTTPS request, with no connection to open or log in
 * to on the Worker. No open-ended transactions: use a Postgres function for anything that must be all-or-nothing.
 * `fetch` is for tests (see `neonFetchOverPostgres`); it is set for the process, as the driver allows.
 */
export function createHttpDb(connectionString: string, opts: { fetch?: typeof fetch } = {}): AnyDb {
  if (opts.fetch) neonConfig.fetchFunction = opts.fetch;
  return drizzle({ client: neon(connectionString), schema }) as unknown as AnyDb;
}

