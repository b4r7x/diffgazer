import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/schemas",
      "packages/core",
      "packages/hooks",
      "apps/server",
      "apps/cli",
    ],
    globals: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "**/*.d.ts",
        "**/*.test.ts",
        "**/vitest.config.ts",
      ],
    },
  },
});
