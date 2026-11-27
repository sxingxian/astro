import { defineConfig } from "vitest/config";

// The CPU budget check (starts wrangler dev; slow). Run with `test:cpu`.
export default defineConfig({ test: { include: ["test/**/*.cpu.test.ts"], fileParallelism: false, testTimeout: 240_000 } });
