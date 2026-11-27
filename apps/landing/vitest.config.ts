import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    include: ["scripts/**/*.test.mjs", "components/**/*.test.ts", "components/**/*.test.tsx"],
    exclude: ["e2e/**", "node_modules/**", "out/**"]
  }
});
