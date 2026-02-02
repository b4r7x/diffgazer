import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/schemas",
      "packages/core",
      "packages/api",
      "packages/hooks",
      "apps/server",
      "apps/cli",
      "apps/web",
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
        "**/*.test.tsx",
        "**/vitest.config.ts",
      ],
    },
  },
});
