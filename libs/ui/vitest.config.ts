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
    environment: "jsdom",
    include: ["registry/**/*.test.ts", "registry/**/*.test.tsx"],
    setupFiles: ["./test-setup.ts"],
  },
});
