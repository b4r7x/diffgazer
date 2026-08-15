import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "testing/e2e/**/*.e2e.ts"],
    pool: "forks",
    fileParallelism: true,
    maxWorkers: 4,
    testTimeout: 30_000,
  },
});
