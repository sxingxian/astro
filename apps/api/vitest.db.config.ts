import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Cloudflare's runtime module, which doesn't exist in Node.
const alias = { "cloudflare:workers": fileURLToPath(new URL("./test/stubs/cloudflare-workers.ts", import.meta.url)) };

export default defineConfig({ resolve: { alias }, test: { include: ["test/**/*.db.test.ts"], fileParallelism: false, testTimeout: 60_000, hookTimeout: 120_000 } });
