import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@/components/ui": path.resolve(import.meta.dirname, "registry/ui"),
      "@/hooks": path.resolve(import.meta.dirname, "registry/hooks"),
      "@/lib": path.resolve(import.meta.dirname, "registry/lib"),
      "@diffgazer/core/theme": path.resolve(import.meta.dirname, "../core/src/theme/index.ts"),
      "@diffgazer/keys/testing/navigation-behavior": path.resolve(
        import.meta.dirname,
        "../keys/dist/testing/navigation-behavior.js",
      ),
      "@diffgazer/keys": path.resolve(import.meta.dirname, "../keys/src/index.ts"),
    },
  },
  test: {
    testTimeout: 10_000,
    projects: [
      {
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: [
            "registry/**/*.test.ts",
            "registry/**/*.test.tsx",
            "scripts/**/*.test.ts",
            "theme/**/*.test.ts",
          ],
          exclude: ["registry/**/ssr/*.test.tsx"],
          setupFiles: ["./src/test-setup.ts"],
          // Typecheck runs only when `test:types` passes `--typecheck`, not on
          // plain `test`; the config below applies to that pass.
          typecheck: {
            tsconfig: "./tsconfig.test.json",
            include: [
              "registry/**/*.test.ts",
              "registry/**/*.test.tsx",
              "scripts/**/*.test.ts",
              "theme/**/*.test.ts",
            ],
            exclude: ["registry/**/ssr/*.test.tsx"],
          },
        },
      },
      {
        extends: true,
        test: {
          name: "ssr",
          environment: "node",
          include: ["registry/**/ssr/*.test.tsx"],
          typecheck: {
            tsconfig: "./tsconfig.test.json",
            include: ["registry/**/ssr/*.test.tsx"],
          },
        },
      },
    ],
  },
});
