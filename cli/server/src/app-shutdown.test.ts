import { SHUTDOWN_TOKEN_HEADER } from "@diffgazer/core/api/protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import { resetShutdownStateForTests } from "./features/shutdown/service.js";
import { log } from "./shared/lib/log.js";

// Boundary mock: logging writes process-visible diagnostics; app tests keep output quiet.
vi.mock("./shared/lib/log.js", () => ({ log: vi.fn() }));

describe("shutdown route", () => {
  let originalCliPid: string | undefined;
  let originalShutdownToken: string | undefined;
  const shutdownHeaders = {
    Host: "localhost:3000",
    [SHUTDOWN_TOKEN_HEADER]: "test-shutdown-token",
  };

  beforeEach(() => {
    originalCliPid = process.env.DIFFGAZER_CLI_PID;
    originalShutdownToken = process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    process.env.DIFFGAZER_SHUTDOWN_TOKEN = "test-shutdown-token";
    vi.mocked(log).mockClear();
  });

  afterEach(() => {
    if (originalCliPid === undefined) {
      delete process.env.DIFFGAZER_CLI_PID;
    } else {
      process.env.DIFFGAZER_CLI_PID = originalCliPid;
    }
    if (originalShutdownToken === undefined) {
      delete process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    } else {
      process.env.DIFFGAZER_SHUTDOWN_TOKEN = originalShutdownToken;
    }
    resetShutdownStateForTests();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("rejects requests without the per-run shutdown token", async () => {
    process.env.DIFFGAZER_CLI_PID = "4321";
    const app = createApp();
    const killSpy = vi.spyOn(process, "kill");

    const res = await app.request("/api/shutdown", {
      method: "POST",
      headers: { Host: "localhost:3000" },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("Unauthorized");
    expect(killSpy).not.toHaveBeenCalled();
  });

  it("rejects requests with the wrong per-run shutdown token", async () => {
    process.env.DIFFGAZER_CLI_PID = "4321";
    const app = createApp();
    const killSpy = vi.spyOn(process, "kill");

    const res = await app.request("/api/shutdown", {
      method: "POST",
      headers: {
        Host: "localhost:3000",
        [SHUTDOWN_TOKEN_HEADER]: "wrong-token",
      },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("Unauthorized");
    expect(killSpy).not.toHaveBeenCalled();
  });

  it("returns 503 when CLI pid is unavailable", async () => {
    delete process.env.DIFFGAZER_CLI_PID;
    const app = createApp();
    const killSpy = vi.spyOn(process, "kill");

    const res = await app.request("/api/shutdown", {
      method: "POST",
      headers: shutdownHeaders,
    });

    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { message: string; code: string } };
    expect(body.error.message).toBe("Shutdown is not available in this environment.");
    expect(body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(killSpy).not.toHaveBeenCalled();
  });

  it.each([
    "abc",
    "1",
    "4321junk",
    "+4321",
    "-4321",
    "4321.0",
    "4.321e3",
    "0x10e1",
    "04321",
    "9007199254740992",
  ])("returns 503 when CLI pid is invalid: %s", async (pid) => {
    process.env.DIFFGAZER_CLI_PID = pid;
    const app = createApp();
    const killSpy = vi.spyOn(process, "kill");

    const res = await app.request("/api/shutdown", {
      method: "POST",
      headers: shutdownHeaders,
    });

    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { message: string; code: string } };
    expect(body.error.message).toBe("Shutdown is not available in this environment.");
    expect(body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(killSpy).not.toHaveBeenCalled();
  });

  it("schedules CLI termination when PID is present", async () => {
    process.env.DIFFGAZER_CLI_PID = " 4321 ";
    const app = createApp();
    vi.useFakeTimers();
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);

    const res = await app.request("/api/shutdown", {
      method: "POST",
      headers: shutdownHeaders,
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(killSpy).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();
    expect(killSpy).toHaveBeenCalledWith(4321, "SIGTERM");
  });

  it("logs failure when process termination throws", async () => {
    process.env.DIFFGAZER_CLI_PID = "4321";
    const app = createApp();
    vi.useFakeTimers();
    const killError = new Error("kill failed");
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => {
      throw killError;
    });

    const res = await app.request("/api/shutdown", {
      method: "POST",
      headers: shutdownHeaders,
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);

    vi.runOnlyPendingTimers();
    expect(killSpy).toHaveBeenCalledWith(4321, "SIGTERM");
    expect(log).toHaveBeenCalledWith("error", "shutdown_cli_terminate_failed", {
      error: killError,
    });
  });

  it("is idempotent while shutdown is already scheduled", async () => {
    process.env.DIFFGAZER_CLI_PID = "4321";
    const app = createApp();
    vi.useFakeTimers();
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);

    const first = await app.request("/api/shutdown", {
      method: "POST",
      headers: shutdownHeaders,
    });
    const second = await app.request("/api/shutdown", {
      method: "POST",
      headers: shutdownHeaders,
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((await first.json()) as { ok: boolean }).toEqual({ ok: true });
    expect((await second.json()) as { ok: boolean }).toEqual({ ok: true });

    vi.runOnlyPendingTimers();
    // call-count IS the contract: shutdown is idempotent — two POSTs must result in exactly one SIGTERM (not zero, not two)
    expect(killSpy).toHaveBeenCalledTimes(1);
  });
});
