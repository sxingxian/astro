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
    console.error("migration failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
