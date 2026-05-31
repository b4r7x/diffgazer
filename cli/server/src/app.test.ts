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

describe("CORS in packaged mode", () => {
  let originalPackaged: string | undefined;

  beforeEach(() => {
    originalPackaged = process.env.DIFFGAZER_PACKAGED;
    process.env.DIFFGAZER_PACKAGED = "1";
  });

  afterEach(() => {
    if (originalPackaged === undefined) {
      delete process.env.DIFFGAZER_PACKAGED;
    } else {
      process.env.DIFFGAZER_PACKAGED = originalPackaged;
    }
  });

  it("allows same-origin requests (matching host and port)", async () => {
    const app = createApp();
    const res = await app.request("/api/health", {
      method: "OPTIONS",
      headers: {
        Host: "localhost:3000",
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "GET",
      },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3000");
  });

  it("rejects cross-port localhost requests", async () => {
    const app = createApp();
    const res = await app.request("/api/health", {
      method: "OPTIONS",
      headers: {
        Host: "localhost:3000",
        Origin: "http://localhost:3001",
        "Access-Control-Request-Method": "GET",
      },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("rejects cross-host localhost requests", async () => {
    const app = createApp();
    const res = await app.request("/api/health", {
      method: "OPTIONS",
      headers: {
        Host: "localhost:3000",
        Origin: "http://127.0.0.1:3000",
        "Access-Control-Request-Method": "GET",
      },
    });

    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("rejects external origins", async () => {
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
    { header: "Referrer-Policy", expected: "no-referrer" },
  ])("sets $header to $expected on every response", async ({ header, expected }) => {
    const app = createApp();
    const res = await app.request("/api/health", {
      headers: { Host: "localhost:3000" },
    });

    expect(res.headers.get(header)).toBe(expected);
  });

  it("sets a restrictive Permissions-Policy on every response", async () => {
    const app = createApp();
    const res = await app.request("/api/health", {
      headers: { Host: "localhost:3000" },
    });

    const policy = res.headers.get("Permissions-Policy");
    expect(policy).toBeTruthy();
    expect(policy).toContain("camera=()");
    expect(policy).toContain("microphone=()");
    expect(policy).toContain("geolocation=()");
  });
});

describe("error handling", () => {
  let originalToken: string | undefined;

  beforeEach(() => {
    originalToken = process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    process.env.DIFFGAZER_SHUTDOWN_TOKEN = "test-token";
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    } else {
      process.env.DIFFGAZER_SHUTDOWN_TOKEN = originalToken;
    }
  });

  it("returns a JSON 404 body for unknown routes", async () => {
    const app = createApp();
    const res = await app.request("/api/nonexistent", {
      headers: { Host: "localhost:3000", [SHUTDOWN_TOKEN_HEADER]: "test-token" },
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("Not Found");
  });
});

describe("API token middleware", () => {
  let originalToken: string | undefined;

  beforeEach(() => {
    originalToken = process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    process.env.DIFFGAZER_SHUTDOWN_TOKEN = "test-api-token";
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    } else {
      process.env.DIFFGAZER_SHUTDOWN_TOKEN = originalToken;
    }
  });

  it("allows /api/health without a token", async () => {
    const app = createApp();
    const res = await app.request("/api/health", {
      headers: { Host: "localhost:3000" },
    });

    expect(res.status).toBe(200);
  });

  it.each(["/api/config", "/api/settings", "/api/git", "/api/review"])(
    "rejects %s without a valid token",
    async (route) => {
      const app = createApp();
      const res = await app.request(route, {
        headers: { Host: "localhost:3000" },
      });

      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: { message: string } };
      expect(body.error.message).toBe("Unauthorized");
    }
  );

  it("uses 401 for a missing token and reserves 403 for a forbidden host", async () => {
    const app = createApp();

    const unauthorized = await app.request("/api/config", {
      headers: { Host: "localhost:3000" },
    });
    expect(unauthorized.status).toBe(401);
    expect(((await unauthorized.json()) as { error: { message: string } }).error.message).toBe(
      "Unauthorized",
    );

    const forbidden = await app.request("/api/config", {
      headers: { Host: "evil.com" },
    });
    expect(forbidden.status).toBe(403);
    expect(((await forbidden.json()) as { error: { message: string } }).error.message).toBe(
      "Forbidden",
    );
  });

  it("allows CORS preflight (OPTIONS) without a token", async () => {
    const app = createApp();
    const res = await app.request("/api/config", {
      method: "OPTIONS",
      headers: {
        Host: "localhost:3000",
        Origin: "http://localhost:3001",
        "Access-Control-Request-Method": "POST",
      },
    });

    expect(res.status).not.toBe(403);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3001");
  });

  it("does not reject a tokenized request at the middleware level", async () => {
    const app = createApp();
    const res = await app.request("/api/config", {
      headers: {
        Host: "localhost:3000",
        [SHUTDOWN_TOKEN_HEADER]: "test-api-token",
      },
    });

    // The token middleware should pass; downstream may still fail for other reasons (setup, trust, etc.)
    // but the response should NOT be the token middleware's 401 "Unauthorized" rejection.
    expect(res.status).not.toBe(401);
  });
});

describe("API token gate scoping (standalone dev vs packaged)", () => {
  let originalToken: string | undefined;
  let originalPackaged: string | undefined;

  beforeEach(() => {
    originalToken = process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    originalPackaged = process.env.DIFFGAZER_PACKAGED;
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    } else {
      process.env.DIFFGAZER_SHUTDOWN_TOKEN = originalToken;
    }
    if (originalPackaged === undefined) {
      delete process.env.DIFFGAZER_PACKAGED;
    } else {
      process.env.DIFFGAZER_PACKAGED = originalPackaged;
    }
  });

  it("does not 401 standalone dev API requests when no token is configured and not packaged", async () => {
    delete process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    delete process.env.DIFFGAZER_PACKAGED;
    const app = createApp();

    const res = await app.request("/api/config", {
      headers: { Host: "localhost:3000" },
    });

    // The gate is skipped in standalone dev; the request reaches downstream
    // routing instead of being rejected as Unauthorized.
    expect(res.status).not.toBe(401);
  });

  it("still 401s packaged API requests when no token is configured", async () => {
    delete process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    process.env.DIFFGAZER_PACKAGED = "1";
    const app = createApp();

    const res = await app.request("/api/config", {
      headers: { Host: "localhost:3000" },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("Unauthorized");
  });

  it("enforces a configured token even when not packaged", async () => {
    process.env.DIFFGAZER_SHUTDOWN_TOKEN = "configured-token";
    delete process.env.DIFFGAZER_PACKAGED;
    const app = createApp();

    const rejected = await app.request("/api/config", {
      headers: { Host: "localhost:3000" },
    });
    expect(rejected.status).toBe(401);

    const accepted = await app.request("/api/config", {
      headers: { Host: "localhost:3000", [SHUTDOWN_TOKEN_HEADER]: "configured-token" },
    });
    expect(accepted.status).not.toBe(401);
  });
});

describe("CORS origin rejection", () => {
  let originalToken: string | undefined;

  beforeEach(() => {
    originalToken = process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    process.env.DIFFGAZER_SHUTDOWN_TOKEN = "test-token";
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    } else {
      process.env.DIFFGAZER_SHUTDOWN_TOKEN = originalToken;
    }
  });

  it("rejects POST from a non-localhost origin before the handler runs", async () => {
    const app = createApp();
    const res = await app.request("/api/config", {
      method: "POST",
      headers: {
        Host: "localhost:3000",
        Origin: "https://evil.com",
        "Content-Type": "text/plain",
        [SHUTDOWN_TOKEN_HEADER]: "test-token",
      },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("Forbidden");
  });

  it("allows POST from a localhost origin", async () => {
    const app = createApp();
    const res = await app.request("/api/config", {
      method: "POST",
      headers: {
        Host: "localhost:3000",
        Origin: "http://localhost:3001",
        "Content-Type": "application/json",
        [SHUTDOWN_TOKEN_HEADER]: "test-token",
      },
    });

    // Not rejected by CORS — may fail for other reasons but not 403-Forbidden
    expect(res.status).not.toBe(403);
  });

  it("allows GET from a non-localhost origin (safe method)", async () => {
    const app = createApp();
    const res = await app.request("/api/health", {
      method: "GET",
      headers: {
        Host: "localhost:3000",
        Origin: "https://evil.com",
      },
    });

    expect(res.status).toBe(200);
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

  it.each(["abc", "1"])("returns 503 when CLI pid is invalid: %s", async (pid) => {
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

describe("request observability", () => {
  it("attaches an X-Request-Id header to successful responses", async () => {
    const app = createApp();
    const res = await app.request("/api/health", { headers: { Host: "localhost:3000" } });

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Request-Id")).toMatch(/[0-9a-f-]{36}/);
  });

  it("attaches an X-Request-Id header even to rejected requests", async () => {
    const app = createApp();
    const res = await app.request("/api/config", { headers: { Host: "evil.com" } });

    expect(res.status).toBe(403);
    expect(res.headers.get("X-Request-Id")).toMatch(/[0-9a-f-]{36}/);
  });
});
