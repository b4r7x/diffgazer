import { defineConfig, devices } from "@playwright/test";

const embeddedE2e = process.env.DIFFGAZER_EMBEDDED_E2E === "1";
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? (embeddedE2e ? 4173 : 4174));
// A parity capture is compared against TUI frames rendered from this checkout, so it must
// never adopt a server another checkout left on the fixed port.
const REUSE_EXISTING_SERVER = !process.env.CI && !process.env.DIFFGAZER_PARITY_CAPTURE_DIR;

export default defineConfig({
  testDir: "./testing/e2e",
  testMatch: "**/*.e2e.ts",
  snapshotDir: "./testing/e2e/baselines",
  outputDir: "./test-results",
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
    },
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    contextOptions: {
      reducedMotion: "reduce",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: embeddedE2e
    ? {
        command: "pnpm exec tsx testing/e2e/start-embedded-production-server.ts",
        url: `http://127.0.0.1:${PORT}/api/health`,
        reuseExistingServer: REUSE_EXISTING_SERVER,
        timeout: 120_000,
        env: {
          ...process.env,
          PLAYWRIGHT_PORT: String(PORT),
        },
      }
    : {
        command: `pnpm exec vite --host 127.0.0.1 --port ${PORT}`,
        url: `http://127.0.0.1:${PORT}/testing/fixtures/app-fixture.html`,
        reuseExistingServer: REUSE_EXISTING_SERVER,
        timeout: 120_000,
      },
});
