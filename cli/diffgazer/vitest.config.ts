import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    pool: "forks",
    fileParallelism: false,
    testTimeout: 30_000,
    typecheck: {
      enabled: false,
      tsconfig: "./tsconfig.test.json",
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    },
  },
});
