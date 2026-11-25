import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scripts/**/*.test.mjs", "components/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**", "out/**"]
  }
});
