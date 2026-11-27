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
