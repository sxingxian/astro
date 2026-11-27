import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export { schema };
// Neon's HTTPS client is on its own entry (`@astro/db/http`) so the Next.js apps never load its driver.
export { rowsOf, type AnyDb } from "./rows";
export type Db = ReturnType<typeof createDb>;

/** A Drizzle client on postgres.js. On Workers, pass Hyperdrive's connection string. */
export function createDb(connectionString: string) {
  const client = postgres(connectionString, { max: 5, fetch_types: false, prepare: true, onnotice: () => {} });
  return drizzle(client, { schema });
}

// Query helpers from the same drizzle-orm copy as the schema, so apps never mix two copies.
export { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, ne, not, or, sql } from "drizzle-orm";
