import { afterEach, describe, expect, it, vi } from "vitest";
import { registerServerSet, stopAllServers, stopServerSet } from "./stop-all";

describe("registerServerSet", () => {
  afterEach(async () => {
    await stopAllServers();
    vi.restoreAllMocks();
  });

  it("keeps a re-registered lifecycle active after the previous cleanup settles", async () => {
    let resolveFirstStop = () => {};
    let resolveSecondStop = () => {};
    const firstStopPending = new Promise<void>((resolve) => {
      resolveFirstStop = resolve;
    });
    const secondStopPending = new Promise<void>((resolve) => {
      resolveSecondStop = resolve;
    });
    const server = {
      start: vi.fn(),
      stop: vi.fn().mockReturnValueOnce(firstStopPending).mockReturnValueOnce(secondStopPending),
    };
    const servers = [server];

    const firstCleanup = registerServerSet(servers);
    const firstShutdown = firstCleanup();
    const currentCleanup = registerServerSet(servers);

    expect(firstCleanup()).toBe(firstShutdown);
    await Promise.resolve();
    expect(server.stop).toHaveBeenCalledOnce();

    resolveFirstStop();
    await firstShutdown;

    const globalShutdown = stopAllServers();
    await Promise.resolve();
    const callsAfterGlobalShutdown = server.stop.mock.calls.length;
    const currentShutdown = currentCleanup();
    const repeatedCurrentShutdown = currentCleanup();

    resolveSecondStop();
    await Promise.all([globalShutdown, currentShutdown, repeatedCurrentShutdown]);

    expect(callsAfterGlobalShutdown).toBe(2);
    expect(repeatedCurrentShutdown).toBe(currentShutdown);
    expect(server.stop).toHaveBeenCalledTimes(2);

    await stopAllServers();
    expect(server.stop).toHaveBeenCalledTimes(2);
  });

  it("stops a new server set independently from a pending stop", async () => {
    let resolveFirstStop = () => {};
    const firstStopPending = new Promise<void>((resolve) => {
      resolveFirstStop = resolve;
    });
    const firstServer = {
      start: vi.fn(),
      stop: vi.fn(() => firstStopPending),
    };
    const secondServer = {
      start: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined),
    };
    const firstServers = [firstServer];
    const secondServers = [secondServer];

    const firstShutdown = registerServerSet(firstServers)();
    await registerServerSet(secondServers)();

    expect(firstServer.stop).toHaveBeenCalledOnce();
    expect(secondServer.stop).toHaveBeenCalledOnce();

    await expect(stopServerSet(secondServers)).resolves.toBeUndefined();
    expect(secondServer.stop).toHaveBeenCalledOnce();
    expect(firstServer.stop).toHaveBeenCalledOnce();

    resolveFirstStop();
    await firstShutdown;

    await stopServerSet(firstServers);
    expect(firstServer.stop).toHaveBeenCalledOnce();
  });

  it("attempts every server and unregisters when a stop throws synchronously", async () => {
    const firstServer = {
      start: vi.fn(),
      stop: vi.fn((): Promise<void> => {
        throw new Error("stop failed");
      }),
    };
    const secondServer = {
      start: vi.fn(),
      stop: vi.fn().mockResolvedValue(undefined),
    };
    const servers = [firstServer, secondServer];
    const cleanup = registerServerSet(servers);

    const shutdown = cleanup();
    await expect(shutdown).resolves.toBeUndefined();
    expect(cleanup()).toBe(shutdown);
    await stopAllServers();

    expect(firstServer.stop).toHaveBeenCalledOnce();
    expect(secondServer.stop).toHaveBeenCalledOnce();

    await stopAllServers();
    expect(firstServer.stop).toHaveBeenCalledOnce();
    expect(secondServer.stop).toHaveBeenCalledOnce();
  });

  it("memoizes shutdown before a server re-enters its cleanup", async () => {
    const server = {
      start: vi.fn(),
      stop: vi.fn<() => Promise<void>>(),
    };
    const servers = [server];
    const cleanup = registerServerSet(servers);
    let reentrantShutdown: Promise<void> | undefined;

    server.stop.mockImplementation(() => {
      if (!reentrantShutdown) {
        reentrantShutdown = cleanup();
      }
      return Promise.resolve();
    });

    const shutdown = cleanup();
    await shutdown;

    expect(reentrantShutdown).toBe(shutdown);
    expect(server.stop).toHaveBeenCalledOnce();

    await stopAllServers();
    expect(server.stop).toHaveBeenCalledOnce();
  });
});
