import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/e2e/**/*.e2e.ts"],
    pool: "forks",
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
