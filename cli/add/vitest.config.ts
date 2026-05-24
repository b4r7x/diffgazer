import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    pool: "forks",
    fileParallelism: false,
    testTimeout: 30_000,
    typecheck: {
      enabled: false,
      tsconfig: "./tsconfig.test.json",
      include: ["src/**/*.test.ts"],
    },
  },
});
