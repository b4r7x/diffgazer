import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execaMock = vi.hoisted(() => vi.fn());
// Boundary mock: subprocess launcher for managed child processes.
vi.mock("execa", () => ({ execa: execaMock }));

import { createProcessServer } from "./process";

interface FakeChild extends Promise<unknown> {
  stdout: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
  pid: number;
}

function createFakeChild(): FakeChild {
  const pending = new Promise<unknown>(() => {}) as FakeChild;
  pending.stdout = new EventEmitter();
  pending.kill = vi.fn();
  pending.pid = 4321;
  return pending;
}

const BASE_CONFIG = {
  command: "node",
  args: ["server.js"],
  cwd: "/srv",
  port: 5000,
  readyPattern: "ready",
};

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
    server.start();
    child.stdout.emit("data", Buffer.from("ready"));

    await vi.waitFor(() => {
      expect(onReady).toHaveBeenCalledExactlyOnceWith("http://localhost:5000");
    });
  });

  it("suppresses onReady when readyCheck rejects", async () => {
    const child = createFakeChild();
    execaMock.mockReturnValue(child);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onReady = vi.fn();
    const readyCheck = vi.fn().mockRejectedValue(new Error("unhealthy"));

    const server = createProcessServer({ ...BASE_CONFIG, onReady, readyCheck });
    server.start();
    child.stdout.emit("data", Buffer.from("ready"));

    await vi.waitFor(() => {
      expect(readyCheck).toHaveBeenCalledWith("http://localhost:5000");
    });
    expect(onReady).not.toHaveBeenCalled();
  });

  it("runs readyCheck on the ready pattern even without onReady", async () => {
    const child = createFakeChild();
    execaMock.mockReturnValue(child);
    const readyCheck = vi.fn().mockResolvedValue(undefined);

    const server = createProcessServer({ ...BASE_CONFIG, readyCheck });
    server.start();
    child.stdout.emit("data", Buffer.from("ready"));

    await vi.waitFor(() => {
      expect(readyCheck).toHaveBeenCalledWith("http://localhost:5000");
    });
  });

  it("uses resolveReadyAddress when Vite reports a different port", async () => {
    const child = createFakeChild();
    execaMock.mockReturnValue(child);
    const onReady = vi.fn();
    const resolveReadyAddress = vi.fn(
      (_output: string, defaultAddress: string) => `${defaultAddress}/vite`,
    );

    const server = createProcessServer({
      ...BASE_CONFIG,
      onReady,
      resolveReadyAddress,
    });
    server.start();
    child.stdout.emit("data", Buffer.from("ready\n  ➜  Local:   http://localhost:3002/"));

    await vi.waitFor(() => {
      expect(resolveReadyAddress).toHaveBeenCalled();
      expect(onReady).toHaveBeenCalledExactlyOnceWith("http://localhost:5000/vite");
    });
  });

  it("clears crashed child state so start can spawn a new process", async () => {
    let rejectChild: (error: Error) => void = () => {};
    const child = new Promise<unknown>((_resolve, reject) => {
      rejectChild = reject;
    }) as FakeChild;
    child.stdout = new EventEmitter();
    child.kill = vi.fn();

    execaMock.mockReturnValueOnce(child);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const server = createProcessServer({ ...BASE_CONFIG });
    server.start();
    rejectChild(new Error("child crashed"));

    await vi.waitFor(() => {
      expect(execaMock).toHaveBeenCalledTimes(1);
    });

    const child2 = createFakeChild();
    execaMock.mockReturnValueOnce(child2);
    server.start();

    expect(execaMock).toHaveBeenCalledTimes(2);
  });

  it("runs readyCheck only once across repeated ready output", async () => {
    const child = createFakeChild();
    execaMock.mockReturnValue(child);
    const readyCheck = vi.fn().mockResolvedValue(undefined);

    const server = createProcessServer({ ...BASE_CONFIG, readyCheck });
    server.start();
    child.stdout.emit("data", Buffer.from("ready"));
    child.stdout.emit("data", Buffer.from("ready again"));

    await vi.waitFor(() => {
      expect(readyCheck).toHaveBeenCalledTimes(1);
    });
  });
});

describe("createProcessServer shutdown", () => {
  const realPlatform = process.platform;

  beforeEach(() => {
    execaMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(process, "platform", { value: realPlatform });
    vi.restoreAllMocks();
  });

  function setPlatform(platform: NodeJS.Platform): void {
    Object.defineProperty(process, "platform", { value: platform });
  }

  it("spawns dev children detached so they lead their own process group on POSIX", () => {
    setPlatform("linux");
    const child = createFakeChild();
    execaMock.mockReturnValue(child);

    const server = createProcessServer({ ...BASE_CONFIG });
    server.start();

    expect(execaMock).toHaveBeenCalledWith(
      BASE_CONFIG.command,
      BASE_CONFIG.args,
      expect.objectContaining({ detached: true }),
    );
  });

  it("does not detach on Windows", () => {
    setPlatform("win32");
    const child = createFakeChild();
    execaMock.mockReturnValue(child);

    const server = createProcessServer({ ...BASE_CONFIG });
    server.start();

    expect(execaMock).toHaveBeenCalledWith(
      BASE_CONFIG.command,
      BASE_CONFIG.args,
      expect.objectContaining({ detached: false }),
    );
  });

  it("force-kills the whole process group on POSIX when the child does not exit", async () => {
    vi.useFakeTimers();
    setPlatform("linux");
    const child = createFakeChild();
    execaMock.mockReturnValue(child);
    const processKill = vi.spyOn(process, "kill").mockImplementation(() => true);

    const server = createProcessServer({ ...BASE_CONFIG });
    server.start();
    void server.stop();

    await Promise.resolve();
    expect(processKill).toHaveBeenCalledWith(-child.pid, "SIGTERM");

    await vi.advanceTimersByTimeAsync(10_000);
    expect(processKill).toHaveBeenCalledWith(-child.pid, "SIGKILL");
    expect(child.kill).not.toHaveBeenCalled();
  });

  it("falls back to the direct child kill when group signaling fails", async () => {
    vi.useFakeTimers();
    setPlatform("linux");
    const child = createFakeChild();
    execaMock.mockReturnValue(child);
    vi.spyOn(process, "kill").mockImplementation(() => {
      throw Object.assign(new Error("no such process"), { code: "ESRCH" });
    });

    const server = createProcessServer({ ...BASE_CONFIG });
    server.start();
    void server.stop();

    await Promise.resolve();
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("signals the direct child on Windows without negative-pid group kill", async () => {
    setPlatform("win32");
    const child = createFakeChild();
    execaMock.mockReturnValue(child);
    const processKill = vi.spyOn(process, "kill").mockImplementation(() => true);

    const server = createProcessServer({ ...BASE_CONFIG });
    server.start();
    void server.stop();

    await Promise.resolve();
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");
    expect(processKill).not.toHaveBeenCalled();
  });
});
