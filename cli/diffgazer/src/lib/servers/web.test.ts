import { describe, expect, it, vi } from "vitest";

const execaMock = vi.hoisted(() => vi.fn());
// Boundary mock: subprocess launcher for the Vite dev child.
vi.mock("execa", () => ({ execa: execaMock }));

import { createFakeChild } from "../../testing/server-process-fixtures";
import { createWebServer, resolveViteReadyAddress } from "./web";

describe("resolveViteReadyAddress", () => {
  it("uses the actual Local URL when Vite falls back to another port", () => {
    const output =
      "Port 3001 is in use, trying another one...\n  ➜  Local:   http://localhost:3002/\n";

    expect(resolveViteReadyAddress(output, "http://localhost:3001")).toBe("http://localhost:3002");
  });

  it("falls back to the requested port when Vite does not print a Local URL", () => {
    expect(resolveViteReadyAddress("starting vite", "http://localhost:3001")).toBe(
      "http://localhost:3001",
    );
  });
});

describe("createWebServer", () => {
  function withShutdownTokenEnv(token: string | undefined, run: () => void): void {
    const originalToken = process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    const originalViteToken = process.env.VITE_DIFFGAZER_SHUTDOWN_TOKEN;
    // The Vite var is cleared too, so the assertion proves the launcher derives
    // it from the ensured token rather than inheriting an ambient value.
    delete process.env.VITE_DIFFGAZER_SHUTDOWN_TOKEN;
    if (token === undefined) delete process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    else process.env.DIFFGAZER_SHUTDOWN_TOKEN = token;

    try {
      run();
    } finally {
      if (originalToken === undefined) delete process.env.DIFFGAZER_SHUTDOWN_TOKEN;
      else process.env.DIFFGAZER_SHUTDOWN_TOKEN = originalToken;
      if (originalViteToken === undefined) delete process.env.VITE_DIFFGAZER_SHUTDOWN_TOKEN;
      else process.env.VITE_DIFFGAZER_SHUTDOWN_TOKEN = originalViteToken;
    }
  }

  function spawnViteChild(): Record<string, string | undefined> {
    execaMock.mockReset();
    execaMock.mockReturnValue(createFakeChild());

    void createWebServer({
      cwd: "/repo/apps/web",
      port: 3001,
      apiUrl: "http://127.0.0.1:7317",
    }).start();

    const env = execaMock.mock.calls[0]?.[2]?.env;
    if (!env) throw new Error("Vite child was not spawned with an environment");
    return env;
  }

  it("feeds the ensured shutdown token to the Vite child under the VITE_ prefix", () => {
    withShutdownTokenEnv("ensured-dev-token", () => {
      const env = spawnViteChild();

      expect(env.VITE_DIFFGAZER_SHUTDOWN_TOKEN).toBe("ensured-dev-token");
      expect(env.VITE_API_URL).toBe("http://127.0.0.1:7317");
    });
  });

  it("spawns the Vite child tokenless when no shutdown token is ensured", () => {
    withShutdownTokenEnv(undefined, () => {
      const env = spawnViteChild();

      expect(env).not.toHaveProperty("VITE_DIFFGAZER_SHUTDOWN_TOKEN");
      expect(env.VITE_API_URL).toBe("http://127.0.0.1:7317");
    });
  });
});
