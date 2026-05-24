import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./lib/shutdown-token.js", () => ({
  ensureShutdownToken: vi.fn(),
}));

import type { ServerController } from "./lib/servers/create-process-server.js";
import { startWeb } from "./web-launcher.js";

function createMockServer(): ServerController & { startCalls: number; stopCalls: number } {
  const server = {
    startCalls: 0,
    stopCalls: 0,
    start() {
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
  });

  it("calls start on every created server", () => {
    const serverA = createMockServer();
    const serverB = createMockServer();
    const printBanner = vi.fn();

    startWeb(
      { mode: "prod", openBrowser: false },
      {
        createServerFactories: () => [() => serverA, () => serverB],
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
        printBanner: vi.fn(),
      },
    );

    await expect(stop()).resolves.toBeUndefined();
  });
});
