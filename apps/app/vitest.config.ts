import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL(".", import.meta.url)) };

// Unit tests only. Tests that need Postgres end in .db.test.ts and run with `test:db`.
export default defineConfig({ resolve: { alias }, test: { include: ["test/**/*.test.ts"], exclude: ["test/**/*.db.test.ts", "node_modules/**"] } });
