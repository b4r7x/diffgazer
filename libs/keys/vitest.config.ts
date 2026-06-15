import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.ts"],
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    testTimeout: 10_000,
    // Typecheck runs only when `test:types` passes `--typecheck`, not on plain
    // `test`; the tsconfig/include below configure that pass.
    typecheck: {
      tsconfig: "./tsconfig.test.json",
      include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.ts"],
    },
  },
});
