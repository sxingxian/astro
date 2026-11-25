import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export { schema };
export type Db = ReturnType<typeof createDb>;

/** A Drizzle client on postgres.js. On Workers, pass Hyperdrive's connection string. */
export function createDb(connectionString: string) {
  const client = postgres(connectionString, { max: 5, fetch_types: false, prepare: true, onnotice: () => {} });
  return drizzle(client, { schema });
}
