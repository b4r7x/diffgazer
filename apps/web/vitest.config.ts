import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Ensure diff-ui's built code resolves the workspace keyscope (new API),
      // not the published keyscope@0.1.1 which has an incompatible return shape.
      keyscope: path.resolve(__dirname, "../../../keyscope/dist/index.js"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
