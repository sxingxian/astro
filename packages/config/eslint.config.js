import js from "@eslint/js";
import tseslint from "typescript-eslint";

/** Shared flat config for every Astro package and app. */
export default tseslint.config(
  { ignores: ["**/dist/**", "**/out/**", "**/.next/**", "**/coverage/**", "**/playwright-report/**", "**/test-results/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-eval": "error",
      "no-implied-eval": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }]
    }
  }
);
