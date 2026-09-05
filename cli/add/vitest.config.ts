import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "testing/e2e/**/*.e2e.ts"],
    pool: "forks",
    fileParallelism: true,
    maxWorkers: 4,
    globalSetup: ["./testing/global-setup.ts"],
    // The e2e suites spawn the CLI built by globalSetup up to four times per
    // test, well under a second each. The floor is the child deadline in
    // testing/e2e/test-helpers.ts (25 s): a wedged child must hit its own
    // timeout before vitest's, so afterEach still removes the fixture.
    testTimeout: 30_000,
  },
});
