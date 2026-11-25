import postgres from "postgres";
import { runMigrations } from "../src/migrate";

/** Drops everything in the test database and applies every migration from scratch. */
export async function resetAndMigrate(url: string): Promise<void> {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe("drop schema if exists drizzle cascade; drop schema public cascade; create schema public;");
  await sql.end();
  await runMigrations(url);
}
