import { describe, expect, test } from "vitest";
import { ensureShutdownToken } from "./shutdown-token";

describe("ensureShutdownToken", () => {
  test("creates a per-process shutdown token and exposes it to web runtime env", () => {
    const originalShutdownToken = process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    const originalViteToken = process.env.VITE_DIFFGAZER_SHUTDOWN_TOKEN;
    process.env.DIFFGAZER_SHUTDOWN_TOKEN = "shell-token";
    delete process.env.VITE_DIFFGAZER_SHUTDOWN_TOKEN;

    try {
      const token = ensureShutdownToken();

      expect(token).toMatch(/^[a-f0-9]{64}$/);
      expect(token).not.toBe("shell-token");
      expect(process.env.DIFFGAZER_SHUTDOWN_TOKEN).toBe(token);
      expect(process.env.VITE_DIFFGAZER_SHUTDOWN_TOKEN).toBe(token);
      expect(ensureShutdownToken()).toBe(token);
    } finally {
      if (originalShutdownToken === undefined) {
        delete process.env.DIFFGAZER_SHUTDOWN_TOKEN;
      } else {
        process.env.DIFFGAZER_SHUTDOWN_TOKEN = originalShutdownToken;
      }
      if (originalViteToken === undefined) {
        delete process.env.VITE_DIFFGAZER_SHUTDOWN_TOKEN;
      } else {
        process.env.VITE_DIFFGAZER_SHUTDOWN_TOKEN = originalViteToken;
      }
    }
  });
});
