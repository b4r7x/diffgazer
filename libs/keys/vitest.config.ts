import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "jsdom",
    mockReset: true,
    coverage: {
      provider: "v8",
      thresholds: {
        lines: 70,
        branches: 60,
        functions: 70,
      },
    },
    typecheck: {
      enabled: false,
      tsconfig: "./tsconfig.test.json",
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    },
  },
});
