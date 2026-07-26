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
    // A reader with no stored preference now follows the OS, so the emulated
    // scheme decides what every spec renders. Pinning dark keeps the visual
    // baselines and the chrome specs on the theme they were authored against;
    // the theme spec emulates light explicitly where it needs the other side.
    colorScheme: "dark",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Mirrors apps/web's mobile-chromium project: a touch device is the only way
    // to exercise the `pointer-coarse:` branches of the docs chrome for real.
    //
    // Behavioural specs only. Visual regression stays on `chromium`: the ten
    // `toHaveScreenshot` specs assert component pixels through the docs site, and
    // a second device would double a two-OS baseline matrix for components that
    // merely render narrower. `testMatch` is therefore an opt-in list — a newly
    // added desktop spec never silently joins the mobile run.
    {
      name: "mobile-chromium",
      testMatch: [
        // Anchor: asserts the project really reports `(pointer: coarse)` and proves
        // the docs chrome's touch branches (search close button, hero wordmark clamp).
        "**/pointer-coarse.e2e.ts",
        // The drawer is the mobile navigation contract: focus trap, inert chrome,
        // close-on-navigate. Its one desktop-only test is gated per-test.
        "**/navigation.e2e.ts",
        // The theme toggle is the chrome's other persistent control; it must stay
        // reachable by tap and persist across a reload on a touch device.
        "**/theme.e2e.ts",
        // Coarse-pointer tab rows are taller, so "wraps without horizontal page
        // scroll" is a device-dependent contract, not a viewport-width one.
        "**/tabs-reflow.e2e.ts",
        // Dialog footer actions must stay inside the viewport and stay tappable
        // once the coarse-pointer minimum heights apply.
        "**/dialog-footer-reflow.e2e.ts",
        // The `pointer-coarse:before:` hit-area extensions only exist on a touch
        // device, and only a real hit test can prove a clip or a neighbour has not
        // eaten one.
        "**/button-hit-area.e2e.ts",
        // The home fold is a phone contract: the hero has to leave the session
        // panel visible above the footer at 375x667.
        "**/home-fold.e2e.ts",
      ],
      use: { ...devices["Pixel 7"] },
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
