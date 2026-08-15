import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    // Ink renders through chalk, which reads colour support once at import. Frame
    // assertions read raw rows, so the suite pins colour off instead of inheriting
    // the operator's terminal; the few colour tests opt back in from `vi.hoisted`.
    env: { FORCE_COLOR: "0" },
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "scripts/**/*.test.ts",
      "testing/e2e/**/*.e2e.ts",
    ],
    pool: "forks",
    fileParallelism: false,
    testTimeout: 45_000,
  },
});
