import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@diffgazer/keys": path.resolve(__dirname, "../../libs/keys/src/index.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "*.test.ts"],
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    // Same budget as the other interaction-heavy workspaces (apps/docs, cli/add): the
    // userEvent flows here (wizard steps, dialog consent gating) run 1-2s alone but
    // stretch by an order of magnitude when `turbo run test` fans every workspace out at
    // once, and this is the largest jsdom suite in the repo.
    testTimeout: 30_000,
  },
});
