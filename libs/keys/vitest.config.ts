import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "jsdom",
    mockReset: true,
    typecheck: {
      enabled: true,
      tsconfig: "./tsconfig.test.json",
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    },
  },
});
