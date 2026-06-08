import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@/components/ui": path.resolve(import.meta.dirname, "registry/ui"),
      "@/hooks": path.resolve(import.meta.dirname, "registry/hooks"),
      "@/lib": path.resolve(import.meta.dirname, "registry/lib"),
      "@diffgazer/keys": path.resolve(import.meta.dirname, "../keys/src/index.ts"),
    },
  },
  test: {
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
          typecheck: {
            enabled: true,
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
            enabled: true,
            tsconfig: "./tsconfig.test.json",
            include: ["registry/**/ssr/*.test.tsx"],
          },
        },
      },
    ],
  },
});
