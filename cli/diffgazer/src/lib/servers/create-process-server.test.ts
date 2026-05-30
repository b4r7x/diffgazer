import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execaMock = vi.hoisted(() => vi.fn());
vi.mock("execa", () => ({ execa: execaMock }));

import { createProcessServer } from "./create-process-server";

interface FakeChild extends Promise<unknown> {
  stdout: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
}

function createFakeChild(): FakeChild {
  const pending = new Promise<unknown>(() => {}) as FakeChild;
  pending.stdout = new EventEmitter();
  pending.kill = vi.fn();
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
