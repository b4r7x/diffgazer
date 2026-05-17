import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SHUTDOWN_TOKEN_HEADER } from "@diffgazer/core/api";
import { createApp } from "./app.js";
import { resetShutdownStateForTests } from "./features/shutdown/service.js";

describe("host validation middleware", () => {
  it.each(["localhost:3000", "127.0.0.1:3000", "[::1]:3000", "localhost"])(
    "serves health for trusted host header %s",
    async (hostHeader) => {
      const app = createApp();
      const res = await app.request("/api/health", {
        headers: { Host: hostHeader },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string };
      expect(body.status).toBe("ok");
    }
  );

  it.each([
    { label: "external hostname", host: "evil.com" },
    { label: "external hostname with port", host: "evil.com:3000" },
  ])("forbids requests from $label", async ({ host }) => {
    const app = createApp();
    const res = await app.request("/api/health", {
      headers: { Host: host },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("Forbidden");
  });

  it("forbids requests with no host header", async () => {
    const app = createApp();
    const res = await app.request("/api/health");

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("Forbidden");
  });
});

describe("CORS configuration", () => {
  it.each([
    { label: "trusted origin", origin: "http://localhost:3001" },
    { label: "localhost on any port", origin: "http://localhost:9999" },
    { label: "127.0.0.1 on any port", origin: "http://127.0.0.1:4200" },
  ])("echoes the request origin for $label", async ({ origin }) => {
    const app = createApp();
    const res = await app.request("/api/health", {
      method: "OPTIONS",
      headers: {
        Host: "localhost:3000",
        Origin: origin,
        "Access-Control-Request-Method": "GET",
      },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  });

  it("omits Access-Control-Allow-Origin for disallowed origins", async () => {
    const app = createApp();
    const res = await app.request("/api/health", {
      method: "OPTIONS",
      headers: {
        Host: "localhost:3000",
        Origin: "https://evil.com",
        "Access-Control-Request-Method": "GET",
      },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("security headers", () => {
  it.each([
    { header: "X-Frame-Options", expected: "DENY" },
    { header: "X-Content-Type-Options", expected: "nosniff" },
  ])("sets $header to $expected on every response", async ({ header, expected }) => {
    const app = createApp();
    const res = await app.request("/api/health", {
      headers: { Host: "localhost:3000" },
    });

    expect(res.headers.get(header)).toBe(expected);
  });
});

describe("error handling", () => {
  it("returns a JSON 404 body for unknown routes", async () => {
    const app = createApp();
    const res = await app.request("/api/nonexistent", {
      headers: { Host: "localhost:3000" },
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("Not Found");
  });
});

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

    expect(res.status).toBe(403);
    const body = (await res.json()) as { ok: boolean; message?: string };
    expect(body).toEqual({ ok: false, message: "Shutdown is not authorized." });
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

    expect(res.status).toBe(403);
    const body = (await res.json()) as { ok: boolean; message?: string };
    expect(body).toEqual({ ok: false, message: "Shutdown is not authorized." });
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
    const body = (await res.json()) as { ok: boolean; message?: string };
    expect(body.ok).toBe(false);
    expect(body.message).toBe("Shutdown is not available in this environment.");
    expect(killSpy).not.toHaveBeenCalled();
  });

  it.each(["abc", "1"])("returns 503 when CLI pid is invalid: %s", async (pid) => {
    process.env.DIFFGAZER_CLI_PID = pid;
    const app = createApp();
    const killSpy = vi.spyOn(process, "kill");

    const res = await app.request("/api/shutdown", {
      method: "POST",
      headers: shutdownHeaders,
    });

    expect(res.status).toBe(503);
    const body = (await res.json()) as { ok: boolean; message?: string };
    expect(body.ok).toBe(false);
    expect(body.message).toBe("Shutdown is not available in this environment.");
    expect(killSpy).not.toHaveBeenCalled();
  });

  it("schedules CLI termination when PID is present", async () => {
    process.env.DIFFGAZER_CLI_PID = "4321";
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
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await app.request("/api/shutdown", {
      method: "POST",
      headers: shutdownHeaders,
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);

    vi.runOnlyPendingTimers();
    expect(killSpy).toHaveBeenCalledWith(4321, "SIGTERM");
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to terminate CLI process via /api/shutdown:",
      killError
    );
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
