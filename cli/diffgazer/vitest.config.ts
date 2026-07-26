import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "scripts/**/*.test.ts",
      "testing/e2e/**/*.e2e.ts",
    ],
    setupFiles: ["./src/testing/test-setup.ts"],
    pool: "forks",
    fileParallelism: false,
    testTimeout: 45_000,
  },
});
