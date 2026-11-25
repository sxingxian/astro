import { defineConfig, devices } from "@playwright/test";

const PORT = 8790;
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
  // Runs the OpenNext build under wrangler dev, against the test database through Hyperdrive's local connection.
  webServer: external
    ? undefined
    : {
        command: "pnpm exec wrangler dev",
        url: `http://127.0.0.1:${PORT}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: (process.env.DATABASE_URL_TEST ?? "").replace("migrator:migrator", "astro_web:astro_web")
        }
      }
});
