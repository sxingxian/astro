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
