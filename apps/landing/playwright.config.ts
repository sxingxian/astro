import { defineConfig, devices } from "@playwright/test";

const external = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: external ?? "http://127.0.0.1:4310",
    ...devices["Desktop Chrome"],
    channel: "chrome",
    // Software WebGL so the starfield renders in headless CI.
    launchOptions: { args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] }
  },
  // Set E2E_BASE_URL (e.g. wrangler dev) to test with the real _headers and CSP.
  webServer: external ? undefined : {
    command: "npx serve out -l 4310 --no-port-switching",
    url: "http://127.0.0.1:4310",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
});
