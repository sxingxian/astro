import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://127.0.0.1:4310", ...devices["Desktop Chrome"], channel: "chrome" },
  webServer: {
    command: "npx serve out -l 4310 --no-port-switching",
    url: "http://127.0.0.1:4310",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
});
