import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@repo/hooks",
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: true,
  },
});
