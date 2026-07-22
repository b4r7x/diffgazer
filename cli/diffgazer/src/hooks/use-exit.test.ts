import { afterEach, describe, expect, it, vi } from "vitest";
import { config } from "../config";
import { registerServerSet, stopAllServers } from "../lib/servers/stop-all";
import { shutdownAndExit } from "./use-exit";

describe("shutdownAndExit", () => {
  afterEach(async () => {
    vi.useRealTimers();
    await stopAllServers();
    vi.restoreAllMocks();
  });

  it("keeps a deferred server registered and exits once after the grace deadline", async () => {
    vi.useFakeTimers();
    let resolveStop = () => {};
    const stopPending = new Promise<void>((resolve) => {
      resolveStop = resolve;
    });
    let resolveStopStarted = () => {};
    const stopStarted = new Promise<void>((resolve) => {
      resolveStopStarted = resolve;
    });
    const server = {
      start: vi.fn(),
      stop: vi.fn(() => {
        resolveStopStarted();
        return stopPending;
      }),
    };
    const servers = [server];
    const stopServers = registerServerSet(servers);
    const exitInk = vi.fn();
    const exitProcess = vi.fn();

    const shutdown = shutdownAndExit(exitInk, exitProcess);
    expect(shutdownAndExit(exitInk, exitProcess)).toBe(shutdown);
    await stopStarted;

    expect(server.stop).toHaveBeenCalledOnce();
    expect(exitInk).not.toHaveBeenCalled();
    expect(exitProcess).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(config.shutdown.gracefulMs);
    await shutdown;

    expect(exitInk).toHaveBeenCalledOnce();
    expect(exitProcess).toHaveBeenCalledOnce();
    expect(server.stop).toHaveBeenCalledOnce();

    let cleanupSettled = false;
    const cleanupProbe = stopServers();
    void cleanupProbe.finally(() => {
      cleanupSettled = true;
    });
    await Promise.resolve();
    expect(cleanupSettled).toBe(false);

    resolveStop();
    await cleanupProbe;
    expect(server.stop).toHaveBeenCalledOnce();

    await stopAllServers();
    expect(server.stop).toHaveBeenCalledOnce();
  });
});
