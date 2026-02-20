import { resolve } from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      keyscope: resolve(import.meta.dirname, "./vendor/keyscope/src/index.ts"),
      "@/components/ui": resolve(import.meta.dirname, "./vendor/registry/ui"),
      "@/hooks": resolve(import.meta.dirname, "./vendor/registry/hooks"),
      "@": resolve(import.meta.dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.ts"],
    exclude: [...configDefaults.exclude, "vendor/**"],
  },
});
