import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "testing/e2e/**/*.e2e.ts"],
    pool: "forks",
    fileParallelism: true,
    maxWorkers: 4,
    // The e2e suites spawn the real CLI through tsx up to four times per test,
    // roughly 8 s each on a two-core CI runner; 30 s timed out the four-run
    // tests there while every run passed. Children keep their own shorter
    // deadline (see testing/e2e/test-helpers.ts), so a hang still fails fast.
    testTimeout: 90_000,
  },
});
