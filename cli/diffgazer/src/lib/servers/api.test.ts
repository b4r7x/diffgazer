import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execaMock = vi.hoisted(() => vi.fn());
// Boundary mock: subprocess launcher for the API child process.
vi.mock("execa", () => ({ execa: execaMock }));

import { createApiServer, waitForHealthy } from "./api";

const ADDRESS = "http://localhost:3000";

function okResponse(): Response {
  return { ok: true } as Response;
}

function unavailableResponse(): Response {
  return { ok: false } as Response;
}

describe("waitForHealthy", () => {
  it("resolves once the health endpoint returns a 200", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    const sleep = vi.fn();

    await expect(waitForHealthy({ address: ADDRESS, fetchImpl, sleep })).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(
      `${ADDRESS}/api/health`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries past connection errors and non-200 responses until healthy", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce(unavailableResponse())
      .mockResolvedValue(okResponse());
    const sleep = vi.fn().mockResolvedValue(undefined);

    await waitForHealthy({ address: ADDRESS, fetchImpl, sleep, intervalMs: 50 });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    for (const call of fetchImpl.mock.calls) {
      expect(call[1]).toEqual(expect.objectContaining({ signal: expect.any(AbortSignal) }));
    }
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenLastCalledWith(50);
  });

  it("passes the remaining timeout to each health probe signal", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(unavailableResponse())
      .mockResolvedValue(okResponse());
    let clock = 1000;
    const sleep = vi.fn((ms: number) => {
      clock += ms;
      return Promise.resolve();
    });
    const now = () => clock;

    await waitForHealthy({
      address: ADDRESS,
      fetchImpl,
      sleep,
      now,
      timeoutMs: 500,
      intervalMs: 125,
    });

    expect(timeoutSpy).toHaveBeenNthCalledWith(1, 500);
    expect(timeoutSpy).toHaveBeenNthCalledWith(2, 375);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    timeoutSpy.mockRestore();
  });

  it("rejects once the timeout elapses without a healthy response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(unavailableResponse());
    const sleep = vi.fn().mockResolvedValue(undefined);
    let clock = 0;
    const now = () => clock;
    sleep.mockImplementation((ms: number) => {
      clock += ms;
      return Promise.resolve();
    });

    await expect(
      waitForHealthy({
        address: ADDRESS,
        fetchImpl,
        sleep,
        now,
        timeoutMs: 100,
        intervalMs: 40,
      }),
    ).rejects.toThrow(/did not become healthy.*within 100ms/);
  });
});

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

describe("createApiServer readiness wiring", () => {
  beforeEach(() => {
    execaMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("probes GET /api/health after the ready pattern even without onReady", async () => {
    const child = createFakeChild();
    execaMock.mockReturnValue(child);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse());

    const server = createApiServer({ cwd: "/srv", port: 4100, projectRoot: "/repo" });
    server.start();
    child.stdout.emit("data", Buffer.from("Server running on 4100"));

    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost:4100/api/health",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });

  it("invokes onReady only after the health probe resolves", async () => {
    const child = createFakeChild();
    execaMock.mockReturnValue(child);
    let resolveHealth: () => void = () => {};
    const healthGate = new Promise<Response>((resolve) => {
      resolveHealth = () => resolve(okResponse());
    });
    vi.spyOn(globalThis, "fetch").mockReturnValue(healthGate);
    const onReady = vi.fn();

    const server = createApiServer({ cwd: "/srv", port: 4200, projectRoot: "/repo", onReady });
    server.start();
    child.stdout.emit("data", Buffer.from("Server running"));

    await Promise.resolve();
    expect(onReady).not.toHaveBeenCalled();

    resolveHealth();
    await vi.waitFor(() => {
      expect(onReady).toHaveBeenCalledExactlyOnceWith("http://localhost:4200");
    });
  });

  it("passes the configured project root to the API child env", () => {
    const child = createFakeChild();
    execaMock.mockReturnValue(child);

    const server = createApiServer({ cwd: "/srv", port: 4300, projectRoot: "/repo/root" });
    server.start();

    expect(execaMock).toHaveBeenCalledWith(
      "npx",
      ["tsx", "src/serve.ts"],
      expect.objectContaining({
        cwd: "/srv",
        env: expect.objectContaining({
          PORT: "4300",
          DIFFGAZER_PROJECT_ROOT: "/repo/root",
        }),
      }),
    );
  });
});
