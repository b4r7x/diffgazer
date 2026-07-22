import { EventEmitter } from "node:events";
import { createServer } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProcessServer } from "./process/server";
import {
  BASE_CONFIG,
  createFakeChild,
  createResolvableFakeChild,
  createSettlingFakeChild,
  type FakeChild,
} from "./process.test-support";

const execaMock = vi.hoisted(() => vi.fn());
// Boundary mock: subprocess launcher for managed child processes.
vi.mock("execa", () => ({ execa: execaMock }));

describe("createProcessServer readiness", () => {
  beforeEach(() => {
    execaMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fires onReady immediately when no readyCheck is configured", async () => {
    const child = createFakeChild();
    execaMock.mockReturnValue(child);
    const onReady = vi.fn();

    const server = createProcessServer({ ...BASE_CONFIG, onReady });
    const starting = server.start();
    child.stdout.emit("data", Buffer.from("ready\n"));

    await expect(starting).resolves.toBeUndefined();
    await vi.waitFor(() => {
      expect(onReady).toHaveBeenCalledExactlyOnceWith("http://localhost:5000");
    });
  });

  it("starts a fresh process after the previous server exits cleanly", async () => {
    const first = createResolvableFakeChild();
    const second = createResolvableFakeChild();
    execaMock.mockReturnValueOnce(first.child).mockReturnValueOnce(second.child);
    const onReady = vi.fn();
    const server = createProcessServer({ ...BASE_CONFIG, onReady });

    const firstStart = server.start();
    first.child.stdout.emit("data", Buffer.from("ready\n"));
    await expect(firstStart).resolves.toBeUndefined();

    first.resolve();
    await first.child;
    await Promise.resolve();

    const secondStart = server.start();
    second.child.stdout.emit("data", Buffer.from("ready\n"));
    await expect(secondStart).resolves.toBeUndefined();

    expect(execaMock).toHaveBeenCalledTimes(2);
    expect(onReady).toHaveBeenCalledTimes(2);
  });

  it("suppresses onReady when readyCheck rejects", async () => {
    const child = createFakeChild();
    execaMock.mockReturnValue(child);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onReady = vi.fn();
    const readyCheck = vi.fn().mockRejectedValue(new Error("unhealthy"));

    const server = createProcessServer({ ...BASE_CONFIG, onReady, readyCheck });
    const starting = server.start();
    child.stdout.emit("data", Buffer.from("ready\n"));

    await vi.waitFor(() => {
      expect(readyCheck).toHaveBeenCalledWith("http://localhost:5000");
    });
    await expect(starting).rejects.toThrow("Server readiness check failed");
    expect(onReady).not.toHaveBeenCalled();
  });

  it("spawns one fresh readiness attempt after a failed check", async () => {
    const firstChild = createSettlingFakeChild();
    const secondChild = createSettlingFakeChild();
    execaMock.mockReturnValueOnce(firstChild).mockReturnValueOnce(secondChild);
    vi.spyOn(process, "kill").mockImplementation(() => {
      throw Object.assign(new Error("no such process"), { code: "ESRCH" });
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    let resolveSecondReadiness = () => {};
    const secondReadiness = new Promise<void>((resolve) => {
      resolveSecondReadiness = resolve;
    });
    const readyCheck = vi
      .fn<(address: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error("unhealthy"))
      .mockReturnValueOnce(secondReadiness);
    const onReady = vi.fn();
    const server = createProcessServer({ ...BASE_CONFIG, readyCheck, onReady });

    const failedStart = server.start();
    firstChild.stdout.emit("data", Buffer.from("ready\n"));

    await expect(failedStart).rejects.toThrow("Server readiness check failed");
    await vi.waitFor(() => expect(firstChild.kill).toHaveBeenCalledWith("SIGTERM"));

    const restarting = server.start();
    const concurrentRestart = server.start();
    expect(concurrentRestart).toBe(restarting);
    let restartSettled = false;
    void restarting.finally(() => {
      restartSettled = true;
    });

    await vi.waitFor(() => expect(execaMock).toHaveBeenCalledTimes(2));
    expect(restartSettled).toBe(false);

    secondChild.stdout.emit("data", Buffer.from("ready\n"));
    await vi.waitFor(() => expect(readyCheck).toHaveBeenCalledTimes(2));
    expect(restartSettled).toBe(false);

    resolveSecondReadiness();
    await expect(restarting).resolves.toBeUndefined();
    expect(onReady).toHaveBeenCalledExactlyOnceWith("http://localhost:5000");

    await server.stop();
  });

  it("does not spawn a queued restart after stop wins during failed-readiness cleanup", async () => {
    let resolveFirstChild = () => {};
    const firstChild = new Promise<void>((resolve) => {
      resolveFirstChild = resolve;
    }) as FakeChild;
    firstChild.stdout = new EventEmitter();
    firstChild.stderr = new EventEmitter();
    firstChild.kill = vi.fn();
    firstChild.pid = 4321;
    execaMock.mockReturnValueOnce(firstChild);
    vi.spyOn(process, "kill").mockImplementation(() => {
      throw Object.assign(new Error("no such process"), { code: "ESRCH" });
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const readyCheck = vi.fn().mockRejectedValueOnce(new Error("unhealthy"));
    const server = createProcessServer({ ...BASE_CONFIG, readyCheck });

    const failedStart = server.start();
    firstChild.stdout.emit("data", Buffer.from("ready\n"));
    await expect(failedStart).rejects.toThrow("Server readiness check failed");
    await vi.waitFor(() => expect(firstChild.kill).toHaveBeenCalledWith("SIGTERM"));

    const queuedRestart = server.start();
    const stopping = server.stop();
    resolveFirstChild();

    await expect(queuedRestart).rejects.toThrow("Server stopped before readiness");
    await stopping;
    expect(execaMock).toHaveBeenCalledOnce();
    expect(readyCheck).toHaveBeenCalledOnce();
  });

  it("runs readyCheck on the ready pattern even without onReady", async () => {
    const child = createFakeChild();
    execaMock.mockReturnValue(child);
    const readyCheck = vi.fn().mockResolvedValue(undefined);

    const server = createProcessServer({ ...BASE_CONFIG, readyCheck });
    server.start();
    child.stdout.emit("data", Buffer.from("ready\n"));

    await vi.waitFor(() => {
      expect(readyCheck).toHaveBeenCalledWith("http://localhost:5000");
    });
  });

  it("reports an unexpected child failure once for each start", async () => {
    const rejections: Array<(error: Error) => void> = [];
    execaMock.mockImplementation(() => {
      const child = new Promise<unknown>((_resolve, reject) => {
        rejections.push(reject);
      }) as FakeChild;
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = vi.fn();
      child.pid = 4321 + rejections.length;
      return child;
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onFailure = vi.fn();
    const server = createProcessServer({ ...BASE_CONFIG, onFailure });

    const firstStart = server.start();
    rejections[0]?.(new Error("first child failed"));
    await expect(firstStart).rejects.toThrow("first child failed");
    await vi.waitFor(() => expect(onFailure).toHaveBeenCalledTimes(1));

    const secondStart = server.start();
    rejections[1]?.(new Error("second child failed"));
    await expect(secondStart).rejects.toThrow("second child failed");
    await vi.waitFor(() => expect(onFailure).toHaveBeenCalledTimes(2));

    expect(onFailure).toHaveBeenNthCalledWith(1, "first child failed");
    expect(onFailure).toHaveBeenNthCalledWith(2, "second child failed");
    expect(execaMock).toHaveBeenCalledTimes(2);
  });

  it("reports a real occupied-port child failure", async () => {
    const actualExeca = await vi.importActual<typeof import("execa")>("execa");
    const blocker = createServer();
    await new Promise<void>((resolve, reject) => {
      blocker.once("error", reject);
      blocker.listen(0, "127.0.0.1", resolve);
    });
    const address = blocker.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP blocker address");
    const onFailure = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const script = [
      'const { createServer } = require("node:http");',
      `createServer((_req, res) => res.end("ok")).listen(${address.port}, "127.0.0.1");`,
    ].join("");
    const server = createProcessServer(
      {
        command: process.execPath,
        args: ["-e", script],
        cwd: process.cwd(),
        port: address.port,
        readyPattern: "never",
        onFailure,
      },
      { spawn: actualExeca.execa },
    );

    try {
      server.start();
      await vi.waitFor(() => {
        expect(onFailure).toHaveBeenCalledOnce();
        expect(onFailure.mock.calls[0]?.[0]).toContain("EADDRINUSE");
      });
    } finally {
      await server.stop();
      await new Promise<void>((resolve, reject) => {
        blocker.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
