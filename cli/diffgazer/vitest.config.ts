import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "testing/e2e/**/*.e2e.ts"],
    setupFiles: ["./src/testing/vitest.setup.ts"],
    pool: "forks",
    fileParallelism: false,
    testTimeout: 45_000,
  },
});
