import { defineProject } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineProject({
  plugins: [react()],
  test: {
    name: "@repo/web",
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@repo/core": path.resolve(__dirname, "../../packages/core/src"),
      "@repo/schemas": path.resolve(__dirname, "../../packages/schemas/src"),
      "@repo/api": path.resolve(__dirname, "../../packages/api/src"),
      "@repo/hooks": path.resolve(__dirname, "../../packages/hooks/src"),
    },
  },
});
