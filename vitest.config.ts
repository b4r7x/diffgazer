import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Use projects array instead of deprecated workspace
    projects: [
      "packages/schemas",
      "packages/core",
      "apps/server",
      "apps/cli",
    ],
    // Global settings applied to all projects
    globals: true,
    // Coverage configuration
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
