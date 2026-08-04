import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    include: ["src/**/*.test.ts"],
    // The workspace default everywhere else. The registry suites build tmpdir
    // fixtures and re-read the committed public/r trees, so the stock 5s cap is
    // the tightest in the repo and is the first to break when `turbo run test`
    // fans out across all 17 packages.
    testTimeout: 10_000,
  },
});
