import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "../../config";
import { shutdownAndExit } from "../../hooks/use-exit";

const execaMock = vi.hoisted(() => vi.fn());
// Boundary mock: subprocess launcher for managed child processes.
vi.mock("execa", () => ({ execa: execaMock }));

import { createProcessServer } from "./process";
import { activeServerSets, registerServerSet, stopAllServers } from "./stop-all";
import { resolveViteReadyAddress } from "./web";

interface FakeChild extends Promise<unknown> {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
  pid: number;
}

function createFakeChild(): FakeChild {
  const pending = new Promise<unknown>(() => {}) as FakeChild;
  pending.stdout = new EventEmitter();
  pending.stderr = new EventEmitter();
  pending.kill = vi.fn();
  pending.pid = 4321;
  return pending;
}

function createSettlingFakeChild(): FakeChild {
  let resolveChild = () => {};
  const child = new Promise<void>((resolve) => {
    resolveChild = resolve;
  }) as FakeChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn(() => resolveChild());
  child.pid = 4321;
  return child;
}

function createResolvableFakeChild(): { child: FakeChild; resolve: () => void } {
  let resolveChild = () => {};
  const child = new Promise<void>((resolve) => {
    resolveChild = resolve;
  }) as FakeChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  child.pid = 4321;
  return { child, resolve: resolveChild };
}

const BASE_CONFIG = {
  command: "node",
  args: ["server.js"],
  cwd: "/srv",
  port: 5000,
  readyPattern: "ready",
};

const VITE_READY_LINE = "  ➜  Local:   http://localhost:3002/\n";
const VITE_MARKER_START = VITE_READY_LINE.indexOf("Local:");
const VITE_URL_START = VITE_READY_LINE.indexOf("http://");
const VITE_SPLIT_BOUNDARIES = Array.from(
  { length: VITE_URL_START - VITE_MARKER_START },
  (_, index) => VITE_MARKER_START + index + 1,
);

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
    child.stdout.emit("data", Buffer.from("ready\n  ➜  Local:   http://localhost:3002/\n"));

    await vi.waitFor(() => {
      expect(resolveReadyAddress).toHaveBeenCalled();
      expect(onReady).toHaveBeenCalledExactlyOnceWith("http://localhost:5000/vite");
    });
  });

  it.each(
    VITE_SPLIT_BOUNDARIES,
  )("resolves a Vite auto-selected port when its complete ready line is split at byte %i", async (splitAt) => {
    const child = createFakeChild();
    execaMock.mockReturnValue(child);
    const onReady = vi.fn();
    const server = createProcessServer({
      ...BASE_CONFIG,
      readyPattern: "Local:",
      resolveReadyAddress: resolveViteReadyAddress,
      onReady,
    });

    const starting = server.start();
    child.stdout.emit("data", Buffer.from(VITE_READY_LINE.slice(0, splitAt)));
    expect(onReady).not.toHaveBeenCalled();
    child.stdout.emit("data", Buffer.from(VITE_READY_LINE.slice(splitAt)));

    await expect(starting).resolves.toBeUndefined();
    expect(onReady).toHaveBeenCalledExactlyOnceWith("http://localhost:3002");
  });

  it("waits for the line terminator before resolving a matching ready line", async () => {
    const child = createFakeChild();
    execaMock.mockReturnValue(child);
    const onReady = vi.fn();
    const server = createProcessServer({ ...BASE_CONFIG, onReady });

    const starting = server.start();
    child.stdout.emit("data", Buffer.from("ready"));
    await Promise.resolve();
    expect(onReady).not.toHaveBeenCalled();

    child.stdout.emit("data", Buffer.from("\n"));
    await expect(starting).resolves.toBeUndefined();
    expect(onReady).toHaveBeenCalledExactlyOnceWith("http://localhost:5000");
  });

  it("clears crashed child state so start can spawn a new process", async () => {
    let rejectChild: (error: Error) => void = () => {};
    const child = new Promise<unknown>((_resolve, reject) => {
      rejectChild = reject;
    }) as FakeChild;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = vi.fn();

    execaMock.mockReturnValueOnce(child);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const server = createProcessServer({ ...BASE_CONFIG });
    const firstStart = server.start();
    rejectChild(new Error("child crashed"));

    await expect(firstStart).rejects.toThrow("child crashed");

    await vi.waitFor(() => {
      expect(execaMock).toHaveBeenCalledTimes(1);
    });

    const child2 = createFakeChild();
    execaMock.mockReturnValueOnce(child2);
    server.start();

    expect(execaMock).toHaveBeenCalledTimes(2);
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

  it("runs readyCheck only once across repeated ready output", async () => {
    const child = createFakeChild();
    execaMock.mockReturnValue(child);
    const readyCheck = vi.fn().mockResolvedValue(undefined);

    const server = createProcessServer({ ...BASE_CONFIG, readyCheck });
    const starting = server.start();
    child.stdout.emit("data", Buffer.from("ready\n"));
    child.stdout.emit("data", Buffer.from("ready again\n"));

    await vi.waitFor(() => {
      expect(readyCheck).toHaveBeenCalledTimes(1);
    });
    await expect(starting).resolves.toBeUndefined();
  });

  it("keeps only the bounded stderr tail when a child crashes", async () => {
    let rejectChild: (error: Error) => void = () => {};
    const child = new Promise<unknown>((_resolve, reject) => {
      rejectChild = reject;
    }) as FakeChild;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = vi.fn();
    child.pid = 4321;
    execaMock.mockReturnValue(child);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const server = createProcessServer({ ...BASE_CONFIG });
    const starting = server.start();
    child.stderr.emit("data", Buffer.from(`${"x".repeat(20 * 1024)}tail`));
    rejectChild(new Error("child crashed"));

    await expect(starting).rejects.toThrow();

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(1));
    const diagnostic = String(consoleError.mock.calls[0]?.[0]);
    expect(Buffer.byteLength(diagnostic)).toBeLessThanOrEqual(16 * 1024);
    expect(diagnostic.endsWith("tail")).toBe(true);
  });

  it("keeps a noisy real child alive after output exceeds maxBuffer", async () => {
    const actualExeca = await vi.importActual<typeof import("execa")>("execa");
    const tempDir = mkdtempSync(join(tmpdir(), "dg-process-server-"));
    const markerPath = join(tempDir, "alive");
    const onReady = vi.fn();
    const script = [
      'const { writeFileSync } = require("node:fs");',
      'process.stdout.write("ready\\n");',
      'process.stdout.write("x".repeat(64 * 1024));',
      'setTimeout(() => writeFileSync(process.argv[1], "alive"), 150);',
      "setInterval(() => {}, 1000);",
    ].join("");
    const server = createProcessServer(
      {
        command: process.execPath,
        args: ["-e", script, markerPath],
        cwd: tempDir,
        port: 5000,
        readyPattern: "ready",
        onReady,
      },
      { spawn: actualExeca.execa, maxBuffer: 1024 },
    );

    try {
      server.start();
      await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(1), { timeout: 3_000 });
      await vi.waitFor(() => expect(existsSync(markerPath)).toBe(true), { timeout: 3_000 });
    } finally {
      await server.stop();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("createProcessServer shutdown", () => {
  const realPlatform = process.platform;

  beforeEach(() => {
    execaMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    activeServerSets.clear();
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
      expect.objectContaining({ buffer: false, detached: true }),
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

  it("retains the group watchdog after the direct wrapper settles", async () => {
    vi.useFakeTimers();
    setPlatform("linux");
    let resolveChild = () => {};
    const child = new Promise<void>((resolve) => {
      resolveChild = resolve;
    }) as FakeChild;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = vi.fn();
    child.pid = 4321;
    execaMock.mockReturnValue(child);
    let groupAlive = true;
    const processKill = vi.spyOn(process, "kill").mockImplementation((_pid, signal) => {
      if (signal === "SIGKILL") groupAlive = false;
      if (signal === 0 && !groupAlive) {
        throw Object.assign(new Error("no such process group"), { code: "ESRCH" });
      }
      return true;
    });

    const server = createProcessServer({ ...BASE_CONFIG });
    server.start();
    const stopping = server.stop();
    resolveChild();
    await Promise.resolve();

    expect(processKill).not.toHaveBeenCalledWith(-child.pid, "SIGKILL");
    await vi.advanceTimersByTimeAsync(config.shutdown.forceKillMs);
    await stopping;

    expect(processKill).toHaveBeenCalledWith(-child.pid, "SIGKILL");
  });

  it.runIf(process.platform !== "win32")(
    "kills a SIGTERM-resistant real descendant before stop resolves",
    async () => {
      const actualExeca = await vi.importActual<typeof import("execa")>("execa");
      const tempDir = mkdtempSync(join(tmpdir(), "dg-process-group-"));
      const markerPath = join(tempDir, "descendant.pid");
      const descendantScript = 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);';
      const wrapperScript = [
        'const { spawn } = require("node:child_process");',
        'const { writeFileSync } = require("node:fs");',
        "const [marker, descendantScript] = process.argv.slice(1);",
        "const child = spawn(process.execPath, ['-e', descendantScript], { stdio: 'ignore' });",
        "writeFileSync(marker, String(child.pid));",
        'process.stdout.write("ready\\n");',
        "setInterval(() => {}, 1000);",
      ].join("");
      const server = createProcessServer(
        {
          command: process.execPath,
          args: ["-e", wrapperScript, markerPath, descendantScript],
          cwd: tempDir,
          port: 5000,
          readyPattern: "ready",
        },
        { spawn: actualExeca.execa, forceKillMs: 100 },
      );
      let descendantPid: number | undefined;

      try {
        server.start();
        await vi.waitFor(() => expect(existsSync(markerPath)).toBe(true), { timeout: 3_000 });
        const pid = Number(readFileSync(markerPath, "utf-8"));
        descendantPid = pid;

        await server.stop();

        expect(() => process.kill(pid, 0)).toThrow();
      } finally {
        if (descendantPid) {
          try {
            process.kill(descendantPid, "SIGKILL");
          } catch {}
        }
        rmSync(tempDir, { recursive: true, force: true });
      }
    },
  );

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

  it("does not resolve on a non-ESRCH group signal failure until group absence is proven", async () => {
    vi.useFakeTimers();
    setPlatform("linux");
    let resolveChild = () => {};
    const child = new Promise<void>((resolve) => {
      resolveChild = resolve;
    }) as FakeChild;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = vi.fn();
    child.pid = 4321;
    execaMock.mockReturnValue(child);
    let groupAbsent = false;
    const processKill = vi.spyOn(process, "kill").mockImplementation((_pid, signal) => {
      if (signal === "SIGTERM") {
        throw Object.assign(new Error("not permitted"), { code: "EPERM" });
      }
      if (signal === "SIGKILL") groupAbsent = true;
      if (signal === 0 && groupAbsent) {
        throw Object.assign(new Error("no such process group"), { code: "ESRCH" });
      }
      if (signal === 0) {
        throw Object.assign(new Error("not permitted"), { code: "EPERM" });
      }
      return true;
    });
    const server = createProcessServer({ ...BASE_CONFIG });
    server.start();
    let stopped = false;
    const stopping = server.stop().then(() => {
      stopped = true;
    });
    resolveChild();

    await vi.advanceTimersByTimeAsync(config.shutdown.forceKillMs - 1);
    expect(stopped).toBe(false);
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");

    await vi.advanceTimersByTimeAsync(1);
    await stopping;

    expect(processKill).toHaveBeenCalledWith(-child.pid, "SIGKILL");
    expect(stopped).toBe(true);
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
    expect(activeServerSets.has(servers)).toBe(true);
    expect(exitInk).not.toHaveBeenCalled();
    expect(exitProcess).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(config.shutdown.gracefulMs);
    await shutdown;

    expect(exitInk).toHaveBeenCalledOnce();
    expect(exitProcess).toHaveBeenCalledOnce();
    expect(server.stop).toHaveBeenCalledOnce();
    expect(activeServerSets.has(servers)).toBe(true);

    resolveStop();
    await stopServers();
    expect(server.stop).toHaveBeenCalledOnce();
    expect(activeServerSets.has(servers)).toBe(false);
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
    const activeAfterPreviousCleanup = activeServerSets.has(servers);

    const globalShutdown = stopAllServers();
    await Promise.resolve();
    const callsAfterGlobalShutdown = server.stop.mock.calls.length;
    const currentShutdown = currentCleanup();
    const repeatedCurrentShutdown = currentCleanup();

    resolveSecondStop();
    await Promise.all([globalShutdown, currentShutdown, repeatedCurrentShutdown]);

    expect(activeAfterPreviousCleanup).toBe(true);
    expect(callsAfterGlobalShutdown).toBe(2);
    expect(repeatedCurrentShutdown).toBe(currentShutdown);
    expect(server.stop).toHaveBeenCalledTimes(2);
    expect(activeServerSets.has(servers)).toBe(false);
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
    expect(activeServerSets.has(firstServers)).toBe(true);
    expect(activeServerSets.has(secondServers)).toBe(false);

    resolveFirstStop();
    await firstShutdown;
    expect(activeServerSets.has(firstServers)).toBe(false);
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
    expect(activeServerSets.has(servers)).toBe(false);
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
    expect(activeServerSets.has(servers)).toBe(false);
  });
});
