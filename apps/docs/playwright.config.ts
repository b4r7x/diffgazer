import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./testing/e2e",
  testMatch: "**/*.e2e.ts",
  snapshotDir: "./testing/e2e/baselines",
  outputDir: "./test-results",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
    },
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    colorScheme: "light",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Serve through the built Nitro server entry (not `vite preview`) so the
    // per-path Content-Security-Policy from server.ts is actually applied; the
    // static preview emits no headers and would never exercise the hash CSP.
    command: "node .output/server/index.mjs",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      HOST: "127.0.0.1",
      PORT: String(PORT),
      NODE_OPTIONS: "--dns-result-order=ipv4first",
    },
  },
});
