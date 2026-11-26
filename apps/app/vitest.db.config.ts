import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL(".", import.meta.url)) };

export default defineConfig({ resolve: { alias }, test: { include: ["test/**/*.db.test.ts"], fileParallelism: false, testTimeout: 30_000, hookTimeout: 60_000 } });
