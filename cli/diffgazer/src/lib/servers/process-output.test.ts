import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProcessServer } from "./process/server";
import {
  BASE_CONFIG,
  createFakeChild,
  type FakeChild,
  VITE_READY_LINE,
  VITE_SPLIT_BOUNDARIES,
} from "./process.test-support";
import { resolveViteReadyAddress } from "./web";

const execaMock = vi.hoisted(() => vi.fn());
// Boundary mock: subprocess launcher for managed child processes.
vi.mock("execa", () => ({ execa: execaMock }));

describe("createProcessServer output", () => {
  beforeEach(() => {
    execaMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("uses the stdout tail as the failure diagnostic when a child crashes without stderr output", async () => {
    let rejectChild: (error: Error) => void = () => {};
    const child = new Promise<unknown>((_resolve, reject) => {
      rejectChild = reject;
    }) as FakeChild;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = vi.fn();
    child.pid = 4321;
    execaMock.mockReturnValue(child);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onFailure = vi.fn();

    const server = createProcessServer({ ...BASE_CONFIG, onFailure });
    const starting = server.start();
    child.stdout.emit("data", Buffer.from("boot failed: missing config\n"));
    rejectChild(new Error("child exited unexpectedly"));

    await expect(starting).rejects.toThrow("boot failed: missing config");
    await vi.waitFor(() => {
      expect(onFailure).toHaveBeenCalledExactlyOnceWith("boot failed: missing config");
    });
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
