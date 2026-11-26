import { defineConfig } from "vitest/config";

// Unit tests only. Tests that need Postgres end in .db.test.ts and run with `test:db`.
export default defineConfig({ test: { include: ["test/**/*.test.ts"], exclude: ["test/**/*.db.test.ts", "node_modules/**"] } });
