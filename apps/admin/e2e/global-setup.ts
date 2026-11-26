import { resetAndMigrate } from "@astro/db/testing";
import { startAiStub } from "./ai-stub";

/** Fresh, migrated test database before every e2e run (e2e runs one app at a time), and the AI gateway stub. */
export default async function globalSetup() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("DATABASE_URL_TEST is not set");
  await resetAndMigrate(url);
  const stub = await startAiStub();
  return () => new Promise<void>((resolve) => stub.close(() => resolve()));
}
