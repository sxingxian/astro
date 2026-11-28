import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Cloudflare's runtime module, which doesn't exist in Node.
const alias = { "cloudflare:workers": fileURLToPath(new URL("./test/stubs/cloudflare-workers.ts", import.meta.url)) };

// The CPU budget check (starts wrangler dev; slow). Run with `test:cpu`.
export default defineConfig({ resolve: { alias }, test: { include: ["test/**/*.cpu.test.ts"], fileParallelism: false, testTimeout: 600_000 } });
