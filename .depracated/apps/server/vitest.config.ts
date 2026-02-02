import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@repo/server",
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: true,
    testTimeout: 10000,
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
  },
});
