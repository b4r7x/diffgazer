import { createServer as createTcpServer } from "node:net";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServerFactories } from "./lib/servers/factories";
import { createProcessServer, type ServerController } from "./lib/servers/process";
import { startWeb } from "./web-launcher";

const ensureShutdownToken = vi.fn();

function createMockServer(): ServerController & { startCalls: number; stopCalls: number } {
  const server = {
    startCalls: 0,
    stopCalls: 0,
    async start() {
      server.startCalls++;
    },
    stop() {
      server.stopCalls++;
      return Promise.resolve();
    },
  };
  return server;
}

describe("startWeb", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    ensureShutdownToken.mockReset();
    process.exitCode = undefined;
  });

  it("calls start on every created server", () => {
    const serverA = createMockServer();
    const serverB = createMockServer();
    const printBanner = vi.fn();

    startWeb(
      { mode: "prod", openBrowser: false },
      {
        createServerFactories: () => [() => serverA, () => serverB],
        ensureShutdownToken,
        printBanner,
      },
    );

    expect(serverA.startCalls).toBe(1);
    expect(serverB.startCalls).toBe(1);
    expect(printBanner).toHaveBeenCalledOnce();
  });

  it("returns a stop function that calls stop on every server", async () => {
    const serverA = createMockServer();
    const serverB = createMockServer();

    const stop = startWeb(
      { mode: "prod", openBrowser: false },
      {
        createServerFactories: () => [() => serverA, () => serverB],
        ensureShutdownToken,
        printBanner: vi.fn(),
      },
    );

    await stop();

    expect(serverA.stopCalls).toBe(1);
    expect(serverB.stopCalls).toBe(1);
  });

  it("returns the same promise for idempotent stop calls", async () => {
    const server = createMockServer();

    const stop = startWeb(
      { mode: "prod", openBrowser: false },
      {
        createServerFactories: () => [() => server],
        ensureShutdownToken,
        printBanner: vi.fn(),
      },
    );

    const p1 = stop();
    const p2 = stop();

    expect(p1).toBe(p2);
    await p1;
    expect(server.stopCalls).toBe(1);
  });

  it("works with zero servers", async () => {
    const stop = startWeb(
      { mode: "prod", openBrowser: false },
      {
        createServerFactories: () => [],
        ensureShutdownToken,
        printBanner: vi.fn(),
      },
    );

    await expect(stop()).resolves.toBeUndefined();
  });

  it("exits with code 1 when a server reports a startup failure", async () => {
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(console, "error").mockImplementation(() => {});

    startWeb(
      { mode: "prod", openBrowser: false },
      {
        ensureShutdownToken,
        printBanner: vi.fn(),
        createServerFactories: ({ onStartupFailure }) => [
          () => ({
            async start() {
              onStartupFailure?.("embedded web failed");
            },
            stop: () => Promise.resolve(),
          }),
        ],
      },
    );

    await vi.waitFor(() => {
      expect(exit).toHaveBeenCalledWith(1);
    });
    expect(process.exitCode).toBe(1);
  });

  it("stops the Vite peer and exits nonzero when the real dev API child hits EADDRINUSE", async () => {
    const blocker = createTcpServer();
    await new Promise<void>((resolve, reject) => {
      blocker.once("error", reject);
      blocker.listen(0, "127.0.0.1", resolve);
    });
    const address = blocker.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP blocker address");

    const vite = createMockServer();
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const originalPort = process.env.PORT;
    const originalShutdownToken = process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    const originalViteShutdownToken = process.env.VITE_DIFFGAZER_SHUTDOWN_TOKEN;
    process.env.PORT = String(address.port);
    let childFailure: string | undefined;
    let stop: (() => Promise<void>) | undefined;

    try {
      stop = startWeb(
        { mode: "dev", openBrowser: false },
        {
          createServerFactories: (options) =>
            createServerFactories(
              {
                ...options,
                onStartupFailure: (message) => {
                  childFailure = message;
                  options.onStartupFailure?.(message);
                },
              },
              {
                createApiServer: (apiConfig) =>
                  createProcessServer({
                    command: process.execPath,
                    args: [
                      "-e",
                      `require("node:net").createServer().listen(${apiConfig.port}, "127.0.0.1")`,
                    ],
                    cwd: process.cwd(),
                    port: apiConfig.port,
                    readyPattern: "never",
                    onFailure: apiConfig.onFailure,
                  }),
                createWebServer: () => vite,
              },
            ),
        },
      );

      await vi.waitFor(
        () => {
          expect(childFailure).toContain("EADDRINUSE");
          expect(vite.stopCalls).toBe(1);
          expect(exit).toHaveBeenCalledExactlyOnceWith(1);
        },
        { timeout: 10_000 },
      );
      expect(vite.startCalls).toBe(1);
      expect(process.exitCode).toBe(1);
    } finally {
      await stop?.();
      await new Promise<void>((resolve, reject) => {
        blocker.close((error) => (error ? reject(error) : resolve()));
      });
      if (originalPort === undefined) delete process.env.PORT;
      else process.env.PORT = originalPort;
      if (originalShutdownToken === undefined) delete process.env.DIFFGAZER_SHUTDOWN_TOKEN;
      else process.env.DIFFGAZER_SHUTDOWN_TOKEN = originalShutdownToken;
      if (originalViteShutdownToken === undefined) {
        delete process.env.VITE_DIFFGAZER_SHUTDOWN_TOKEN;
      } else {
        process.env.VITE_DIFFGAZER_SHUTDOWN_TOKEN = originalViteShutdownToken;
      }
      process.exitCode = undefined;
    }
  });

  it("prints the banner before starting web servers and stops them on cleanup", async () => {
    const events: string[] = [];

    const stop = startWeb(
      { mode: "prod", openBrowser: false },
      {
        ensureShutdownToken,
        printBanner: () => events.push("banner"),
        createServerFactories: () => [
          () => ({
            start: async () => {
              events.push("start");
            },
            stop: () => {
              events.push("stop");
              return Promise.resolve();
            },
          }),
        ],
      },
    );

    expect(events).toEqual(["banner", "start"]);
    await stop();
    await stop();

    expect(events).toEqual(["banner", "start", "stop"]);
  });
});
