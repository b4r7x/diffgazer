import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@repo/api",
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: true,
    testTimeout: 10000,
    fileParallelism: false,
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
  },
});
