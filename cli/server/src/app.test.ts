import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROJECT_ROOT_HEADER, SHUTDOWN_TOKEN_HEADER } from "@diffgazer/core/api/protocol";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import { HTTPException } from "hono/http-exception";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import { resetShutdownStateForTests } from "./features/shutdown/service.js";
import { setReviewRekeyHandler } from "./shared/lib/config/store.js";
import { log } from "./shared/lib/log.js";
import { makeIssue } from "./shared/lib/testing/factories.js";

// Boundary mock: logging writes process-visible diagnostics; app tests keep output quiet.
vi.mock("./shared/lib/log.js", () => ({ log: vi.fn() }));
// Boundary mock: keyring is the OS keychain wrapper; report it unavailable so the re-key test avoids the native binding.
vi.mock("./shared/lib/config/keyring.js", () => ({
  isKeyringAvailable: vi.fn(() => false),
  readKeyringSecret: vi.fn(() => ({ ok: true, value: null })),
  writeKeyringSecret: vi.fn(() => ({ ok: true, value: undefined })),
  deleteKeyringSecret: vi.fn(() => ({ ok: true, value: true })),
}));

describe("host validation middleware", () => {
  it.each([
    "localhost:3000",
    "127.0.0.1:3000",
    "[::1]:3000",
    "localhost",
  ])("serves health for trusted host header %s", async (hostHeader) => {
    const app = createApp();
    const res = await app.request("/api/health", {
      headers: { Host: hostHeader },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

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

  it("allows the shared project and shutdown headers on preflight", async () => {
    const app = createApp();
    const res = await app.request("/api/health", {
      method: "OPTIONS",
      headers: {
        Host: "localhost:3000",
        Origin: "http://localhost:3001",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": `${PROJECT_ROOT_HEADER}, ${SHUTDOWN_TOKEN_HEADER}`,
      },
    });

    const allowHeaders = res.headers.get("Access-Control-Allow-Headers");
    expect(allowHeaders?.split(",").map((value) => value.trim())).toEqual(
      expect.arrayContaining([PROJECT_ROOT_HEADER, SHUTDOWN_TOKEN_HEADER]),
    );
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
  let originalUnsafeProjectRoot: string | undefined;

  beforeEach(() => {
    originalToken = process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    originalUnsafeProjectRoot = process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT;
    process.env.DIFFGAZER_SHUTDOWN_TOKEN = "test-token";
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    } else {
      process.env.DIFFGAZER_SHUTDOWN_TOKEN = originalToken;
    }
    if (originalUnsafeProjectRoot === undefined) {
      delete process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT;
    } else {
      process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT = originalUnsafeProjectRoot;
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

  it("returns a generic JSON 500 with a request id when a route throws", async () => {
    const app = createApp();
    app.get("/__throws__", () => {
      throw new Error("boom");
    });

    const res = await app.request("/__throws__", { headers: { Host: "localhost:3000" } });

    expect(res.status).toBe(500);
    // The request-logger tail runs through onError and sets the id header, so
    // the generic error response still carries exactly one X-Request-Id.
    expect(res.headers.get("X-Request-Id")).toMatch(/[0-9a-f-]{36}/);
    const body = (await res.json()) as { error: { message: string; code: string } };
    expect(body.error.message).toBe("Internal Server Error");
    expect(body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
  });

  it.each([
    { status: 400, code: ErrorCode.VALIDATION_ERROR },
    { status: 401, code: ErrorCode.UNAUTHORIZED },
    { status: 403, code: ErrorCode.FORBIDDEN },
    { status: 404, code: ErrorCode.NOT_FOUND },
    { status: 405, code: ErrorCode.VALIDATION_ERROR },
    { status: 409, code: ErrorCode.VALIDATION_ERROR },
    { status: 413, code: ErrorCode.PAYLOAD_TOO_LARGE },
    { status: 422, code: ErrorCode.VALIDATION_ERROR },
    { status: 429, code: ErrorCode.RATE_LIMITED },
    { status: 451, code: ErrorCode.VALIDATION_ERROR },
  ] as const)("maps HTTPException $status to the exact wire status and code", async ({
    status,
    code,
  }) => {
    const app = createApp();
    app.get(`/__http_exception_${status}`, () => {
      throw new HTTPException(status, { message: `boundary-${status}` });
    });

    const res = await app.request(`/__http_exception_${status}`, {
      headers: { Host: "localhost:3000" },
    });

    expect(res.status).toBe(status);
    await expect(res.json()).resolves.toEqual({
      error: { message: `boundary-${status}`, code },
    });
  });

  it("preserves HTTPException boundary headers on the JSON wire response", async () => {
    const app = createApp();
    app.get("/__http_exception_headers", () => {
      throw new HTTPException(401, {
        message: "Missing token",
        res: new Response(null, { headers: { "WWW-Authenticate": 'Bearer realm="diffgazer"' } }),
      });
    });

    const res = await app.request("/__http_exception_headers", {
      headers: { Host: "localhost:3000" },
    });

    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toBe('Bearer realm="diffgazer"');
    expect(res.headers.get("Content-Type")).toContain("application/json");
    await expect(res.json()).resolves.toEqual({
      error: { message: "Missing token", code: ErrorCode.UNAUTHORIZED },
    });
  });

  it("maps malformed JSON to the validation-error wire envelope", async () => {
    const app = createApp();
    const res = await app.request("/api/settings", {
      method: "POST",
      headers: {
        Host: "localhost:3000",
        "Content-Type": "application/json",
        [SHUTDOWN_TOKEN_HEADER]: "test-token",
      },
      body: "{",
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: {
        message: "Malformed JSON in request body",
        code: ErrorCode.VALIDATION_ERROR,
      },
    });
  });

  it("maps a rejected development project-root header to validation error 400", async () => {
    const invalidRoot = mkdtempSync(join(tmpdir(), "diffgazer-invalid-root-"));
    process.env.DIFFGAZER_DEV_UNSAFE_PROJECT_ROOT = "1";

    try {
      const app = createApp();
      const res = await app.request("/api/settings/trust", {
        headers: {
          Host: "localhost:3000",
          [PROJECT_ROOT_HEADER]: invalidRoot,
          [SHUTDOWN_TOKEN_HEADER]: "test-token",
        },
      });

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({
        error: {
          message: "Invalid project root: path must be under user home or contain a .git directory",
          code: ErrorCode.VALIDATION_ERROR,
        },
      });
    } finally {
      rmSync(invalidRoot, { recursive: true, force: true });
    }
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

  it.each([
    "/api/config",
    "/api/settings",
    "/api/git",
    "/api/review",
  ])("rejects %s without a valid token", async (route) => {
    const app = createApp();
    const res = await app.request(route, {
      headers: { Host: "localhost:3000" },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("Unauthorized");
  });

  it("returns 401 for a malformed multibyte token header", async () => {
    process.env.DIFFGAZER_SHUTDOWN_TOKEN = "abc";
    const app = createApp();

    const res = await app.request("/api/config", {
      headers: {
        Host: "localhost:3000",
        [SHUTDOWN_TOKEN_HEADER]: "abé",
      },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("Unauthorized");
  });

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

  it("keeps general API open but trust routes closed when split dev has no token", async () => {
    delete process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    delete process.env.DIFFGAZER_PACKAGED;
    const app = createApp();

    const apiResponse = await app.request("/api/config", {
      headers: { Host: "localhost:3000" },
    });
    const trustResponse = await app.request("/api/settings/trust", {
      headers: { Host: "localhost:3000" },
    });

    expect(apiResponse.status).not.toBe(401);
    expect(trustResponse.status).toBe(401);
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

  it("enforces a configured token for split-dev API and trust routes", async () => {
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

    const acceptedTrust = await app.request("/api/settings/trust", {
      headers: { Host: "localhost:3000", [SHUTDOWN_TOKEN_HEADER]: "configured-token" },
    });
    expect(acceptedTrust.status).not.toBe(401);
  });
});

describe("split-dev token gate startup warning", () => {
  let originalToken: string | undefined;
  let originalPackaged: string | undefined;

  beforeEach(() => {
    originalToken = process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    originalPackaged = process.env.DIFFGAZER_PACKAGED;
    vi.mocked(log).mockClear();
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

  it("warns once at startup when running tokenless and unpackaged", () => {
    delete process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    delete process.env.DIFFGAZER_PACKAGED;

    createApp();

    expect(log).toHaveBeenCalledWith(
      "warn",
      "api_token_gate_disabled",
      expect.objectContaining({
        message: expect.stringContaining("DIFFGAZER_SHUTDOWN_TOKEN"),
      }),
    );
  });

  it("does not warn when packaged (gate stays enforced)", () => {
    delete process.env.DIFFGAZER_SHUTDOWN_TOKEN;
    process.env.DIFFGAZER_PACKAGED = "1";

    createApp();

    expect(log).not.toHaveBeenCalledWith("warn", "api_token_gate_disabled", expect.anything());
  });

  it("does not warn when a token is configured", () => {
    process.env.DIFFGAZER_SHUTDOWN_TOKEN = "configured-token";
    delete process.env.DIFFGAZER_PACKAGED;

    createApp();

    expect(log).not.toHaveBeenCalledWith("warn", "api_token_gate_disabled", expect.anything());
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

describe("review re-key wiring", () => {
  let diffgazerHome: string;
  let originalHome: string | undefined;

  const reviewId = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    originalHome = process.env.DIFFGAZER_HOME;
    diffgazerHome = mkdtempSync(join(tmpdir(), "diffgazer-app-rekey-"));
    process.env.DIFFGAZER_HOME = diffgazerHome;
    vi.resetModules();
  });

  afterEach(() => {
    setReviewRekeyHandler(async () => true);
    if (originalHome === undefined) {
      delete process.env.DIFFGAZER_HOME;
    } else {
      process.env.DIFFGAZER_HOME = originalHome;
    }
    rmSync(diffgazerHome, { recursive: true, force: true });
  });

  it("re-keys a moved project's review listing through the createApp-registered handler", async () => {
    // Import after vi.resetModules so createApp, the config store, and the review
    // storage share one module instance (the rekey handler is module-level state).
    const { createApp: freshCreateApp } = await import("./app.js");
    const { saveReview, listReviews } = await import("./features/review/storage/reviews.js");
    const { createConfigStore } = await import("./shared/lib/config/store.js");

    const originalRoot = join(diffgazerHome, "original");
    const movedRoot = join(diffgazerHome, "moved");
    mkdirSync(join(movedRoot, ".diffgazer"), { recursive: true });
    // A .git dir makes the path an allowed project root.
    mkdirSync(join(movedRoot, ".git"), { recursive: true });
    // project.json still points at the original (pre-move) repoRoot.
    writeFileSync(
      join(movedRoot, ".diffgazer", "project.json"),
      JSON.stringify({
        projectId: "stable-id",
        repoRoot: originalRoot,
        createdAt: "2024-01-01T00:00:00.000Z",
      }),
    );

    // A review stored under the original path.
    const saved = await saveReview({
      reviewId,
      projectPath: originalRoot,
      mode: "unstaged",
      branch: "main",
      commit: "abc123",
      lenses: ["correctness"],
      diff: {
        totalStats: { filesChanged: 1, additions: 1, deletions: 0, totalSizeBytes: 100 },
        files: [],
      },
      result: {
        issues: [makeIssue({ id: "i1", title: "Bug", severity: "high", file: "a.ts" })],
      },
    });
    expect(saved.ok).toBe(true);

    // createApp wires the production rekey handler.
    freshCreateApp();

    // Resolving the moved project triggers the move path, which fires the handler.
    const store = createConfigStore();
    const info = store.getProjectInfo(movedRoot);
    expect(info.projectId).toBe("stable-id");

    // The handler is fire-and-forget; wait for the listing to move to the new path.
    await vi.waitFor(
      async () => {
        const underNew = await listReviews(movedRoot);
        if (!underNew.ok || underNew.value.items.length !== 1) {
          throw new Error("listing not yet re-keyed");
        }
        expect(underNew.value.items[0]?.id).toBe(reviewId);
      },
      { timeout: 3000, interval: 20 },
    );

    const underOld = await listReviews(originalRoot);
    expect(underOld.ok).toBe(true);
    if (underOld.ok) expect(underOld.value.items).toEqual([]);
  });

  it("keeps the old root after a review-write failure and commits it after the next retry", async () => {
    const { createApp: freshCreateApp } = await import("./app.js");
    const { saveReview, listReviews } = await import("./features/review/storage/reviews.js");
    const { createConfigStore } = await import("./shared/lib/config/store.js");
    const atomicWrite = await import("./shared/lib/fs.js");
    const originalRoot = join(diffgazerHome, "retry-original");
    const movedRoot = join(diffgazerHome, "retry-moved");
    const projectFilePath = join(movedRoot, ".diffgazer", "project.json");
    mkdirSync(join(movedRoot, ".diffgazer"), { recursive: true });
    mkdirSync(join(movedRoot, ".git"), { recursive: true });
    writeFileSync(
      projectFilePath,
      JSON.stringify({
        projectId: "stable-retry-id",
        repoRoot: originalRoot,
        createdAt: "2024-01-01T00:00:00.000Z",
      }),
    );
    const saved = await saveReview({
      reviewId,
      projectPath: originalRoot,
      mode: "unstaged",
      branch: "main",
      commit: "abc123",
      lenses: ["correctness"],
      diff: {
        totalStats: { filesChanged: 1, additions: 1, deletions: 0, totalSizeBytes: 100 },
        files: [],
      },
      result: {
        issues: [makeIssue({ id: "i1", title: "Bug", severity: "high", file: "a.ts" })],
      },
    });
    expect(saved.ok).toBe(true);

    const realAtomicWrite = atomicWrite.atomicWriteFile;
    let failReviewWrite = true;
    const writeSpy = vi
      .spyOn(atomicWrite, "atomicWriteFile")
      .mockImplementation(async (filePath, content, mode) => {
        if (filePath.includes(`${reviewId}.json`) && failReviewWrite) {
          failReviewWrite = false;
          throw new Error("injected review write failure");
        }
        return realAtomicWrite(filePath, content, mode);
      });

    try {
      freshCreateApp();
      createConfigStore().getProjectInfo(movedRoot);
      await vi.waitFor(() => expect(failReviewWrite).toBe(false));
      await new Promise((resolve) => setImmediate(resolve));
      expect(JSON.parse(readFileSync(projectFilePath, "utf-8"))).toMatchObject({
        repoRoot: originalRoot,
      });

      freshCreateApp();
      const retryStore = createConfigStore();
      await vi.waitFor(() => {
        retryStore.getProjectInfo(movedRoot);
        expect(JSON.parse(readFileSync(projectFilePath, "utf-8"))).toMatchObject({
          repoRoot: movedRoot,
        });
      });

      const underNew = await listReviews(movedRoot);
      const underOld = await listReviews(originalRoot);
      expect(underNew.ok && underNew.value.items.map((item) => item.id)).toEqual([reviewId]);
      expect(underOld.ok && underOld.value.items).toEqual([]);
    } finally {
      writeSpy.mockRestore();
    }
  });
});
