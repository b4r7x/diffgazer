import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/shared/lib/testing/vitest-setup.ts"],
    // Same budget as the other process-heavy workspaces (cli/add, apps/docs): this suite
    // spawns real child processes and builds >1000-file fixtures. Those cases run well
    // under a second alone but stretch by an order of magnitude when `turbo run test`
    // fans every workspace out at once, and the process-tree cases carry multi-second
    // escalation deadlines of their own.
    testTimeout: 30_000,
  },
});
