import path from "node:path";
import { defineConfig } from "vitest/config";

const testInclude = [
  "src/**/*.test.ts",
  "src/**/*.test.tsx",
  "registry/**/*.test.ts",
  "registry/**/*.test.tsx",
  "scripts/**/*.test.ts",
  "examples/playground/src/**/*.test.tsx",
];

export default defineConfig({
  // Mirrors the playground's own vite alias so its demo tests exercise this
  // source tree instead of the published package.
  resolve: {
    alias: {
      "@diffgazer/keys": path.resolve(import.meta.dirname, "src/index.ts"),
    },
  },
  test: {
    include: testInclude,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    testTimeout: 10_000,
    // Spies are restored between tests even when a test fails mid-body, so a
    // stubbed console.error cannot silence the rest of the file.
    restoreMocks: true,
    // Typecheck runs only when `test:types` passes `--typecheck`, not on plain
    // `test`; the tsconfig/include below configure that pass.
    typecheck: {
      tsconfig: "./tsconfig.test.json",
      include: testInclude,
    },
  },
});
