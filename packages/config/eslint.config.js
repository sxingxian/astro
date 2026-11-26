import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Shared flat config for every Astro package and app. */
export default tseslint.config(
  { ignores: ["**/dist/**", "**/out/**", "**/.next/**", "**/coverage/**", "**/playwright-report/**", "**/test-results/**", "**/next-env.d.ts", "**/.wrangler/**", "**/.superpowers/**", "**/.open-next/**", "**/cloudflare-env.d.ts", "**/test-results/**", "**/playwright-report/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "no-eval": "error",
      "no-implied-eval": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }]
    }
  }
);
