import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 4176);

export default defineConfig({
  testDir: "./testing/e2e",
  testMatch: "**/*.e2e.ts",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm exec vite --config vite.e2e.config.ts --host 127.0.0.1 --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/testing/fixtures/popover-focus.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
