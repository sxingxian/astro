import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Cloudflare's runtime module, which doesn't exist in Node.
const alias = { "cloudflare:workers": fileURLToPath(new URL("./test/stubs/cloudflare-workers.ts", import.meta.url)) };

// Unit tests only. Tests that need Postgres end in .db.test.ts and run with `test:db`.
export default defineConfig({ resolve: { alias }, test: { include: ["test/**/*.test.ts"], exclude: ["test/**/*.db.test.ts", "test/**/*.cpu.test.ts", "node_modules/**"] } });
