import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import { resetShutdownStateForTests } from "./features/shutdown/service.js";

// getHostname is not exported, so we test host validation behavior
// through the createApp middleware via Hono's test client approach.

describe("host validation middleware", () => {
  it.each(["localhost:3000", "127.0.0.1:3000", "[::1]:3000", "localhost"])(
    "should return health for allowed host header: %s",
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

  it("should reject requests with external hostname", async () => {
    const app = createApp();
    const res = await app.request("/api/health", {
      headers: { Host: "evil.com" },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("Forbidden");
  });

  it("should reject requests with external hostname and port", async () => {
    const app = createApp();
    const res = await app.request("/api/health", {
      headers: { Host: "evil.com:3000" },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("Forbidden");
  });

  it("should reject requests when host header is missing", async () => {
    const app = createApp();
    const res = await app.request("/api/health");

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("Forbidden");
  });
});

describe("CORS configuration", () => {
  it("should include CORS headers for allowed origin", async () => {
    const app = createApp();
    const res = await app.request("/api/health", {
      method: "OPTIONS",
      headers: {
        Host: "localhost:3000",
        Origin: "http://localhost:3001",
        "Access-Control-Request-Method": "GET",
      },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3001");
  });

  it("should allow localhost on any port", async () => {
    const app = createApp();
    const res = await app.request("/api/health", {
      method: "OPTIONS",
      headers: {
        Host: "localhost:3000",
        Origin: "http://localhost:9999",
        "Access-Control-Request-Method": "GET",
      },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:9999");
  });

  it("should allow 127.0.0.1 on any port", async () => {
    const app = createApp();
    const res = await app.request("/api/health", {
      method: "OPTIONS",
      headers: {
        Host: "localhost:3000",
        Origin: "http://127.0.0.1:4200",
        "Access-Control-Request-Method": "GET",
      },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://127.0.0.1:4200");
  });

  it("should not include CORS allow-origin for disallowed origin", async () => {
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
  it("should set X-Frame-Options to DENY", async () => {
    const app = createApp();
    const res = await app.request("/api/health", {
      headers: { Host: "localhost:3000" },
    });

    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("should set X-Content-Type-Options to nosniff", async () => {
    const app = createApp();
    const res = await app.request("/api/health", {
      headers: { Host: "localhost:3000" },
    });

    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});

describe("error handling", () => {
  it("should return 404 for unknown routes", async () => {
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

  beforeEach(() => {
    originalCliPid = process.env.DIFFGAZER_CLI_PID;
  });

  afterEach(() => {
    if (originalCliPid === undefined) {
      delete process.env.DIFFGAZER_CLI_PID;
    } else {
      process.env.DIFFGAZER_CLI_PID = originalCliPid;
    }
    resetShutdownStateForTests();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns 503 when CLI pid is unavailable", async () => {
    delete process.env.DIFFGAZER_CLI_PID;
    const app = createApp();
    const killSpy = vi.spyOn(process, "kill");

    const res = await app.request("/api/shutdown", {
      method: "POST",
      headers: { Host: "localhost:3000" },
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
      headers: { Host: "localhost:3000" },
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
      headers: { Host: "localhost:3000" },
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
      headers: { Host: "localhost:3000" },
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
      headers: { Host: "localhost:3000" },
    });
    const second = await app.request("/api/shutdown", {
      method: "POST",
      headers: { Host: "localhost:3000" },
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((await first.json()) as { ok: boolean }).toEqual({ ok: true });
    expect((await second.json()) as { ok: boolean }).toEqual({ ok: true });

    vi.runOnlyPendingTimers();
    expect(killSpy).toHaveBeenCalledTimes(1);
  });
});
