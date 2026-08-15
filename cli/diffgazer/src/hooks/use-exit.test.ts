import { afterEach, describe, expect, it, vi } from "vitest";
import { config } from "../config";
import { registerServerSet, stopAllServers } from "../lib/servers/stop-all";
import { __resetShutdownPromiseForTests, shutdownAndExit } from "./use-exit";

describe("shutdownAndExit", () => {
  afterEach(async () => {
    vi.useRealTimers();
    __resetShutdownPromiseForTests();
    await stopAllServers();
    vi.restoreAllMocks();
  });

  it("awaits preparation before stopping servers and exiting", async () => {
    let resolvePrepare: () => void = () => {};
    const prepare = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePrepare = resolve;
        }),
    );
    const exitInk = vi.fn();
    const exitProcess = vi.fn();

    const shutdown = shutdownAndExit(exitInk, exitProcess, prepare);
    expect(prepare).toHaveBeenCalledOnce();
    expect(exitProcess).not.toHaveBeenCalled();

    resolvePrepare();
    await shutdown;

    expect(exitProcess).toHaveBeenCalledWith(0);
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

  it("hands the terminal back and stays retryable when preparation fails", async () => {
    const exitInk = vi.fn();
    const exitProcess = vi.fn();
    const failure = new Error("cleanup failed");

    await expect(
      shutdownAndExit(exitInk, exitProcess, () => Promise.reject(failure)),
    ).rejects.toThrow(failure);
    expect(exitInk).toHaveBeenCalledOnce();
    expect(exitProcess).toHaveBeenCalledOnce();

    // A second Ctrl-C after the failure must run a real shutdown, not replay
    // the rejected one.
    await shutdownAndExit(exitInk, exitProcess);
    expect(exitProcess).toHaveBeenCalledTimes(2);
  });

  it("prints the failure and exits nonzero on the default process-exit path", async () => {
    const exitInk = vi.fn();
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // An OSC-52 clipboard write hidden in the cleanup failure: the escape takes
    // effect the instant the bytes reach the terminal.
    const clipboardWrite = `\u001b]52;c;${Buffer.from("rm -rf ~").toString("base64")}\u0007`;
    const failure = new Error(`${clipboardWrite}Configuration cleanup failed`);

    await expect(
      shutdownAndExit(exitInk, undefined, () => Promise.reject(failure)),
    ).rejects.toThrow(failure);

    expect(exit).toHaveBeenCalledWith(1);
    const printed = errorSpy.mock.calls.map(([value]) => String(value)).join("\n");
    expect(printed).toContain("Configuration cleanup failed");
    expect(printed).not.toContain("\u001b");
    expect(printed).not.toContain("]52;c;");
  });
});
