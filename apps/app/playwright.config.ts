import { defineConfig, devices } from "@playwright/test";

// The free-plan app (astro-api on :8792, with this app behind it for the reader pages): docs/DEPLOYMENT.md §18.
const PORT = 8792;
const external = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: external ?? `http://127.0.0.1:${PORT}`,
    channel: "chrome",
    trace: "retain-on-failure"
  },
  projects: [{ name: "chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
  // The local stack (apps/api/scripts/local-stack.ts): the new Worker, this app's OpenNext build behind it, and Neon
  // stand-ins answering from the test database. Ready once a reader page answers through the binding.
  webServer: external
    ? undefined
    : {
        command: "pnpm --filter @astro/api stack",
        url: `http://127.0.0.1:${PORT}/reader-guidelines`,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000
      }
});
