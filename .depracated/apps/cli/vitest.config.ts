import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@repo/cli",
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: true,
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
  },
});
