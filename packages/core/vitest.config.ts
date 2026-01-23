import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@repo/core",
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: true,
    // Longer timeout for file I/O operations
    testTimeout: 10000,
    // Run tests sequentially to avoid file system conflicts
    fileParallelism: false,
  },
});
