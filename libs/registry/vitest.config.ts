import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    include: ["src/**/*.test.ts"],
    // The registry suites build tmpdir fixtures and re-read the committed public/r
    // trees; the stock 5s cap (only libs/core still runs on it) is the first to
    // break when `turbo run test` fans out across every workspace at once.
    testTimeout: 10_000,
  },
});
