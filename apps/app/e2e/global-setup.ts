import { runMigrations } from "@astro/db/migrate";
import postgres from "postgres";

/** Fresh, migrated test database before every e2e run. */
export default async function globalSetup() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("DATABASE_URL_TEST is not set");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe("drop schema if exists drizzle cascade; drop schema public cascade; create schema public;");
  await sql.end();
  await runMigrations(url);
}
