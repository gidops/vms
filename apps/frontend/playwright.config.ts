import { defineConfig, devices } from "@playwright/test";

/**
 * Browser smoke tests. They expect the app already running (frontend on
 * SMOKE_BASE_URL, API behind it) with a seeded Security Manager account in
 * SMOKE_EMAIL / SMOKE_PASSWORD. Not part of `npm test` (Vitest).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.SMOKE_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        launchOptions: process.env.PW_CHROMIUM_PATH
          ? {
              executablePath: process.env.PW_CHROMIUM_PATH,
              args: ["--no-sandbox"],
            }
          : {},
      },
    },
  ],
});
