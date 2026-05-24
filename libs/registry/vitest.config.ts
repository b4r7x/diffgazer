import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    include: ["src/**/testing/**/*.test.ts"],
    typecheck: {
      enabled: false,
      tsconfig: "./tsconfig.test.json",
      include: ["src/**/testing/**/*.test.ts"],
    },
  },
});
