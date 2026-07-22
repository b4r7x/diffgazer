import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "../../config";
import { createProcessServer } from "./process/server";
import { BASE_CONFIG, createFakeChild, type FakeChild } from "./process.test-support";

const execaMock = vi.hoisted(() => vi.fn());
// Boundary mock: subprocess launcher for managed child processes.
vi.mock("execa", () => ({ execa: execaMock }));

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
});
