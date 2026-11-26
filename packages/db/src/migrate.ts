import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

/** Applies every pending migration. Returns how many were applied. */
export async function runMigrations(connectionString: string): Promise<number> {
  const client = postgres(connectionString, { max: 1, onnotice: () => {} });
  try {
    const db = drizzle(client);
    const count = async () => {
      const [row] = await client<{ n: number }[]>`select count(*)::int as n from drizzle.__drizzle_migrations`.catch(() => [{ n: 0 }]);
      return row?.n ?? 0;
    };
    const before = await count();
    await migrate(db, { migrationsFolder });
    return (await count()) - before;
  } finally {
    await client.end();
  }
}

const hidePasswords = (text: string) => text.replace(/(postgres(?:ql)?:\/\/[^:/@\s]+):[^@\s]+@/gi, "$1:[hidden]@");

/**
 * Turns a migration error into one readable line for the build log: the failed query, Postgres's own reason
 * (drizzle keeps it in `cause`), and a fix for the usual permission gap. Passwords in addresses are hidden.
 */
export function describeMigrationError(err: unknown): string {
  if (!(err instanceof Error)) return hidePasswords(String(err));
  const parts = [err.message.replace(/\s*params:\s*$/, "").trim()];
  const cause = err.cause as { message?: unknown; code?: unknown } | undefined;
  if (cause && typeof cause.message === "string") {
    parts.push(`Postgres says: ${cause.message}${typeof cause.code === "string" ? ` (${cause.code})` : ""}`);
    if (cause.code === "42501" && /CREATE SCHEMA/i.test(err.message)) {
      parts.push('Fix: in Neon\'s SQL Editor run GRANT CREATE ON DATABASE neondb TO migrator; (docs/DEPLOYMENT.md, step 4), then retry the build.');
    }
  }
  return hidePasswords(parts.join("\n"));
}

async function main() {
  const url = process.env.DATABASE_URL_MIGRATOR;
  if (!url) {
    console.error("DATABASE_URL_MIGRATOR is not set");
    process.exit(1);
  }
  const applied = await runMigrations(url);
  console.log(`migrations: ${applied} applied`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err: unknown) => {
    console.error(`migration failed: ${describeMigrationError(err)}`);
    process.exit(1);
  });
}
