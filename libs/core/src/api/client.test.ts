import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "./client.js";
import { PROJECT_ROOT_HEADER, SHUTDOWN_TOKEN_HEADER } from "./protocol.js";

const mockFetch = vi.fn();
// Boundary mock: replaces the global fetch network boundary so tests can stub HTTP responses without hitting a real server.
vi.stubGlobal("fetch", mockFetch);

function lastCall() {
  const call = mockFetch.mock.calls[0];
  if (!call) throw new Error("No fetch calls recorded");
  return call as [string, RequestInit];
}

function lastHeaders() {
  const [, options] = lastCall();
  return new Headers(options.headers);
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(status: number, body?: unknown) {
  return new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createApiClient", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  const client = createApiClient({ baseUrl: "http://localhost:3000" });

  describe("URL construction", () => {
    it("constructs correct URL from base + path", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ ok: true }));

      await client.get("/api/health");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/health",
        expect.any(Object),
      );
    });

    it("normalizes trailing slash on baseUrl", async () => {
      const slashClient = createApiClient({ baseUrl: "http://localhost:3000/" });
      mockFetch.mockResolvedValue(jsonResponse({}));

      await slashClient.get("/api/test");

      expect(mockFetch).toHaveBeenCalledWith("http://localhost:3000/api/test", expect.any(Object));
    });

    it("normalizes path without leading slash", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));

      await client.get("api/test");

      expect(mockFetch).toHaveBeenCalledWith("http://localhost:3000/api/test", expect.any(Object));
    });

    it("appends query params", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));

      await client.get("/api/reviews", { params: { mode: "staged" } });

      const [url] = lastCall();
      expect(url).toContain("mode=staged");
    });
  });

  describe("headers", () => {
    it("sets Accept header on all requests", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));

      await client.get("/api/test");

      expect(lastHeaders().get("Accept")).toBe("application/json");
    });

    it("sets Content-Type on POST requests with body", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));

      await client.post("/api/test", { data: 1 });

      expect(lastHeaders().get("Content-Type")).toBe("application/json");
    });

    it("does not set Content-Type on GET requests", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));

      await client.get("/api/test");

      expect(lastHeaders().get("Content-Type")).toBeNull();
    });

    it.each([
      "/home/zażółć/project",
      "/home/🚀/project",
    ])("encodes a projectRoot header as ASCII-safe transport for %s", async (projectRoot) => {
      const projectClient = createApiClient({
        baseUrl: "http://localhost:3000",
        projectRoot,
      });
      mockFetch.mockResolvedValue(jsonResponse({}));

      await projectClient.get("/api/test");

      expect(lastHeaders().get(PROJECT_ROOT_HEADER)).toBe(encodeURIComponent(projectRoot));
    });

    it("includes custom base headers", async () => {
      const customClient = createApiClient({
        baseUrl: "http://localhost:3000",
        headers: { "X-Custom": "value" },
      });
      mockFetch.mockResolvedValue(jsonResponse({}));

      await customClient.get("/api/test");

      expect(lastHeaders().get("X-Custom")).toBe("value");
    });

    it("includes shutdown token header when configured with a string", async () => {
      const tokenClient = createApiClient({
        baseUrl: "http://localhost:3000",
        shutdownToken: " my-token ",
      });
      mockFetch.mockResolvedValue(jsonResponse({}));

      await tokenClient.get("/api/test");

      expect(lastHeaders().get(SHUTDOWN_TOKEN_HEADER)).toBe("my-token");
    });

    it("includes shutdown token header when configured with a function", async () => {
      const tokenClient = createApiClient({
        baseUrl: "http://localhost:3000",
        shutdownToken: () => "fn-token",
      });
      mockFetch.mockResolvedValue(jsonResponse({}));

      await tokenClient.post("/api/reviews", { mode: "staged" });

      expect(lastHeaders().get(SHUTDOWN_TOKEN_HEADER)).toBe("fn-token");
    });

    it("omits shutdown token header when not configured", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));

      await client.get("/api/test");

      expect(lastHeaders().get(SHUTDOWN_TOKEN_HEADER)).toBeNull();
    });

    it("includes request headers only on that request", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({}));

      await client.post("/api/shutdown", {}, { headers: { "X-Request": "value" } });
      expect(lastHeaders().get("X-Request")).toBe("value");

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce(jsonResponse({}));
      await client.get("/api/test");
      expect(lastHeaders().get("X-Request")).toBeNull();
    });
  });

  describe("HTTP methods", () => {
    type MethodCase = {
      method: "GET" | "POST" | "PUT" | "DELETE";
      expectedBody: string | undefined;
      response: unknown;
      invoke: () => Promise<unknown>;
    };

    const cases: MethodCase[] = [
      {
        method: "GET",
        expectedBody: undefined,
        response: { items: [] },
        invoke: () => client.get<{ items: string[] }>("/api/list"),
      },
      {
        method: "POST",
        expectedBody: JSON.stringify({ name: "test" }),
        response: { id: "1" },
        invoke: () => client.post("/api/create", { name: "test" }),
      },
      {
        method: "PUT",
        expectedBody: JSON.stringify({ name: "updated" }),
        response: { ok: true },
        invoke: () => client.put("/api/update", { name: "updated" }),
      },
      {
        method: "DELETE",
        expectedBody: undefined,
        response: { deleted: true },
        invoke: () => client.delete<{ deleted: boolean }>("/api/item/1"),
      },
    ];

    it.each(
      cases,
    )("$method request sets method=$method, body=$expectedBody and returns the parsed response", async ({
      method,
      expectedBody,
      response,
      invoke,
    }) => {
      mockFetch.mockResolvedValue(jsonResponse(response));

      const result = await invoke();

      expect(result).toEqual(response);
      const [, options] = lastCall();
      expect(options.method).toBe(method);
      expect(options.body).toBe(expectedBody);
    });
  });

  describe("error handling", () => {
    it("throws ApiError with message, status, and code from error envelope", async () => {
      mockFetch.mockResolvedValue(
        errorResponse(409, { error: { message: "Conflict", code: "SESSION_STALE" } }),
      );

      await expect(client.get("/api/test")).rejects.toMatchObject({
        message: "Conflict",
        status: 409,
        code: "SESSION_STALE",
      });
    });

    it("falls back to HTTP status message when body is not JSON", async () => {
      mockFetch.mockResolvedValue(new Response("Server Error", { status: 500 }));

      await expect(client.get("/api/test")).rejects.toThrow("HTTP 500");
    });

    it("throws on network error", async () => {
      mockFetch.mockRejectedValue(new Error("fetch failed"));

      await expect(client.get("/api/test")).rejects.toThrow("fetch failed");
    });

    it("throws ApiError when response body is not valid JSON", async () => {
      mockFetch.mockResolvedValue(
        new Response("not json", { status: 200, headers: { "Content-Type": "text/plain" } }),
      );

      await expect(client.get("/api/test")).rejects.toThrow("Invalid JSON response");
    });

    it("redacts provider diagnostics, credentials, paths, and account identifiers before throwing", async () => {
      const shutdownToken = "shutdown-secret-value";
      const projectRoot = "/Users/alice/projects/private-repo";
      const accountId = "acct-private-123";
      const body = {
        error: {
          message: `provider stderr: bearer ${shutdownToken} accountId=${accountId} at ${projectRoot}/.config/vendor/auth.json`,
          code: "AI_ERROR",
          retryable: true,
          details: `raw CLI output ${"x".repeat(2_000)} token=${shutdownToken}`,
          correlationId: `request-${accountId}`,
        },
      };
      mockFetch.mockResolvedValue(errorResponse(502, body));
      const securedClient = createApiClient({
        baseUrl: "http://localhost:3000",
        projectRoot,
        shutdownToken,
      });

      try {
        await securedClient.get("/api/test");
        throw new Error("Expected request to reject");
      } catch (cause) {
        const error = cause as Error & {
          code?: string;
          correlationId?: string;
          details?: string;
          remediation?: string;
          retryable?: boolean;
          truncatedDetails?: string;
        };
        expect(error.message).toBe("HTTP 502");
        expect(error).toMatchObject({ status: 502, code: "AI_ERROR", retryable: true });
        expect(error.message).not.toContain(shutdownToken);
        expect(error.message).not.toContain(projectRoot);
        expect(error.message).not.toContain(accountId);
        expect(error.details).toBeUndefined();
        expect(error.truncatedDetails).toBeUndefined();
        expect(error.correlationId).toBeUndefined();
        expect(error.remediation).toBeUndefined();
        expect(new TextEncoder().encode(error.message).byteLength).toBeLessThanOrEqual(512);
      }
    });

    it("redacts literal credentials and local bearer values echoed from request bodies", async () => {
      const hostedCredential = "hosted-literal-body-secret";
      const localBearer = "local-bearer-body-secret";
      const body = {
        input: {
          credential: { kind: "literal", value: hostedCredential },
          transport: "local-http",
          authorization: { scheme: "Bearer", token: localBearer },
        },
      };
      mockFetch.mockImplementation((_url, options) => {
        const sent = JSON.parse(String((options as RequestInit).body)) as typeof body;
        const credential = (sent.input.credential as { value: string }).value;
        const bearer = (sent.input.authorization as { token: string }).token;
        return Promise.resolve(
          errorResponse(502, {
            error: {
              message: `server echoed credential=${credential} bearerToken=${bearer}`,
              details: `provider response credential=${credential}; authorization: Bearer ${bearer}`,
              code: "AI_ERROR",
            },
          }),
        );
      });

      try {
        await client.post("/api/config/actions", body);
        throw new Error("Expected request to reject");
      } catch (cause) {
        const error = cause as Error & {
          correlationId?: string;
          details?: string;
          remediation?: string;
          safeMessage?: string;
          truncatedDetails?: string;
        };
        for (const secret of [hostedCredential, localBearer]) {
          expect(error.message).not.toContain(secret);
          expect(error.safeMessage ?? "").not.toContain(secret);
          expect(error.details).toBeUndefined();
          expect(error.truncatedDetails).toBeUndefined();
          expect(error.correlationId).toBeUndefined();
          expect(error.remediation).toBeUndefined();
        }
      }
    });

    it("keeps status/code and a static remediation while dropping opaque diagnostics", async () => {
      mockFetch.mockResolvedValue(
        errorResponse(409, {
          error: {
            message: "Conflict",
            code: "SESSION_STALE",
            retryable: false,
            details: "d".repeat(2_000),
            truncatedDetails: "t".repeat(2_000),
            remediation: "r".repeat(2_000),
            correlationId: "request-123",
          },
        }),
      );

      try {
        await client.get("/api/test");
        throw new Error("Expected request to reject");
      } catch (cause) {
        const error = cause as Error & {
          code?: string;
          correlationId?: string;
          details?: string;
          remediation?: string;
          retryable?: boolean;
          truncatedDetails?: string;
        };
        expect(error).toMatchObject({
          message: "Conflict",
          status: 409,
          code: "SESSION_STALE",
          retryable: false,
        });
        expect(error.details).toBeUndefined();
        expect(error.truncatedDetails).toBeUndefined();
        expect(error.correlationId).toBeUndefined();
        expect(error.remediation).toBe("Review the error and try again.");
        expect(error.remediation).not.toContain("r".repeat(2_000));
        expect(new TextEncoder().encode(error.message).byteLength).toBeLessThanOrEqual(512);
      }
    });

    it("does not forward opaque diagnostic fields even when they look harmless", async () => {
      const opaque = "opaque-secret-xyz";
      mockFetch.mockResolvedValue(
        errorResponse(502, {
          error: {
            message: "Upstream request failed",
            code: "AI_ERROR",
            details: opaque,
            truncatedDetails: opaque,
            remediation: opaque,
            correlationId: opaque,
          },
        }),
      );

      try {
        await client.get("/api/test");
        throw new Error("Expected request to reject");
      } catch (cause) {
        const error = cause as Error & {
          correlationId?: string;
          details?: string;
          remediation?: string;
          truncatedDetails?: string;
        };
        expect(error).toMatchObject({
          message: "Upstream request failed",
          status: 502,
          code: "AI_ERROR",
        });
        expect(error.details).toBeUndefined();
        expect(error.truncatedDetails).toBeUndefined();
        expect(error.correlationId).toBeUndefined();
        expect(error.remediation).toBe("Review the error and try again.");
        expect(JSON.stringify(error)).not.toContain(opaque);
      }
    });

    it("does not trust safeMessage over the validated envelope message", async () => {
      mockFetch.mockResolvedValue(
        errorResponse(502, {
          error: {
            message: "Conflict",
            safeMessage: "safe-message-secret",
            code: "AI_ERROR",
          },
        }),
      );

      try {
        await client.get("/api/test");
        throw new Error("Expected request to reject");
      } catch (cause) {
        const error = cause as Error & { safeMessage?: string; status?: number };
        expect(error).toMatchObject({
          message: "Conflict",
          safeMessage: "Conflict",
          status: 502,
        });
        expect(error.message).not.toContain("safe-message-secret");
        expect(error.safeMessage).not.toContain("safe-message-secret");
      }
    });

    it("uses a bounded json fallback when Response.text is unavailable", async () => {
      const response = {
        ok: false,
        status: 500,
        body: null,
        headers: new Headers({ "content-length": "256" }),
        text: vi.fn().mockRejectedValue(new Error("provider stderr bearer fallback-secret")),
        json: vi.fn().mockResolvedValue({
          error: {
            message: "provider stderr bearer fallback-secret at /Users/alice/.config/auth",
            code: "INTERNAL_ERROR",
          },
        }),
      } as unknown as Response;
      mockFetch.mockResolvedValue(response);

      await expect(client.get("/api/test")).rejects.toMatchObject({
        message: "HTTP 500",
        status: 500,
        code: "INTERNAL_ERROR",
      });
      expect(response.text).toHaveBeenCalledTimes(1);
      expect(response.json).toHaveBeenCalledTimes(1);
    });

    it("fails closed without materializing an unknown-length body-less fallback", async () => {
      const response = {
        ok: false,
        status: 500,
        body: null,
        headers: new Headers(),
        text: vi.fn().mockResolvedValue(`${"x".repeat(70_000)}`),
        json: vi.fn().mockResolvedValue({ error: { message: "x".repeat(70_000) } }),
      } as unknown as Response;
      mockFetch.mockResolvedValue(response);

      await expect(client.get("/api/test")).rejects.toMatchObject({
        message: "HTTP 500",
        status: 500,
      });
      expect(response.text).not.toHaveBeenCalled();
      expect(response.json).not.toHaveBeenCalled();
    });

    it("rejects an oversized text fallback before parsing", async () => {
      const response = {
        ok: false,
        status: 500,
        body: null,
        headers: new Headers({ "content-length": "32" }),
        text: vi
          .fn()
          .mockResolvedValue(
            `${JSON.stringify({ error: { message: "ok" } })}${"x".repeat(70_000)}`,
          ),
        json: vi.fn().mockRejectedValue(new Error("json must not be called")),
      } as unknown as Response;
      mockFetch.mockResolvedValue(response);

      await expect(client.get("/api/test")).rejects.toMatchObject({
        message: "HTTP 500",
        status: 500,
      });
      expect(response.text).toHaveBeenCalledTimes(1);
      expect(response.json).not.toHaveBeenCalled();
    });

    it("rejects an oversized json fallback after bounded serialization", async () => {
      const response = {
        ok: false,
        status: 500,
        body: null,
        headers: new Headers({ "content-length": "32" }),
        text: vi.fn().mockRejectedValue(new Error("text unavailable")),
        json: vi.fn().mockResolvedValue({ error: { message: "x".repeat(70_000) } }),
      } as unknown as Response;
      mockFetch.mockResolvedValue(response);

      await expect(client.get("/api/test")).rejects.toMatchObject({
        message: "HTTP 500",
        status: 500,
      });
      expect(response.json).toHaveBeenCalledTimes(1);
    });

    it("rejects oversized text before parsing or exposing its secret suffix", async () => {
      const secret = "sk-live-adversarial-secret";
      const oversized = `${JSON.stringify({ error: { message: `Conflict token=${secret}` } })}${"x".repeat(70_000)}`;
      mockFetch.mockResolvedValue(new Response(oversized, { status: 500 }));

      try {
        await client.get("/api/test");
        throw new Error("Expected request to reject");
      } catch (cause) {
        const error = cause as Error & { status?: number };
        expect(error.message).toBe("HTTP 500");
        expect(error.message).not.toContain(secret);
        expect(error.status).toBe(500);
      }
    });

    it("bounds streamed response capture and cancels before parsing overflow", async () => {
      const read = vi
        .fn()
        .mockResolvedValueOnce({ done: false, value: new Uint8Array(64 * 1024) })
        .mockResolvedValueOnce({ done: false, value: new Uint8Array([123]) });
      const cancel = vi.fn().mockResolvedValue(undefined);
      const text = vi.fn().mockRejectedValue(new Error("text must not be called"));
      const json = vi.fn().mockRejectedValue(new Error("json must not be called"));
      const response = {
        ok: false,
        status: 502,
        headers: new Headers(),
        body: { getReader: () => ({ read, cancel }) },
        text,
        json,
      } as unknown as Response;
      mockFetch.mockResolvedValue(response);

      await expect(client.get("/api/test")).rejects.toMatchObject({
        message: "HTTP 502",
        status: 502,
      });
      expect(read).toHaveBeenCalledTimes(2);
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(text).not.toHaveBeenCalled();
      expect(json).not.toHaveBeenCalled();
    });

    it("rejects a declared oversized response before reading its body", async () => {
      const read = vi.fn().mockRejectedValue(new Error("body must not be read"));
      const cancel = vi.fn().mockResolvedValue(undefined);
      const response = {
        ok: false,
        status: 502,
        headers: new Headers({ "content-length": String(64 * 1024 + 1) }),
        body: { getReader: () => ({ read, cancel }), cancel },
        text: vi.fn().mockRejectedValue(new Error("text must not be called")),
        json: vi.fn().mockRejectedValue(new Error("json must not be called")),
      } as unknown as Response;
      mockFetch.mockResolvedValue(response);

      await expect(client.get("/api/test")).rejects.toMatchObject({
        message: "HTTP 502",
        status: 502,
      });
      expect(read).not.toHaveBeenCalled();
      expect(cancel).toHaveBeenCalledTimes(1);
    });

    it("bounds body-less test-double json fallback after serialization", async () => {
      const response = {
        ok: false,
        status: 500,
        body: null,
        text: vi.fn().mockRejectedValue(new Error("text unavailable")),
        json: vi.fn().mockResolvedValue({ error: { message: "x".repeat(70_000) } }),
        headers: new Headers({ "content-length": "256" }),
      } as unknown as Response;
      mockFetch.mockResolvedValue(response);

      await expect(client.get("/api/test")).rejects.toMatchObject({
        message: "HTTP 500",
        status: 500,
      });
      expect(response.json).toHaveBeenCalledTimes(1);
    });
  });

  describe("response validation", () => {
    const numberSchema = (body: unknown): { value: number } => {
      if (
        typeof body !== "object" ||
        body === null ||
        typeof (body as { value?: unknown }).value !== "number"
      ) {
        throw new Error("Expected { value: number }");
      }
      return body as { value: number };
    };

    it("returns the validated body when the schema accepts it", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ value: 42 }));

      const result = await client.get<{ value: number }>("/api/test", { schema: numberSchema });

      expect(result).toEqual({ value: 42 });
    });

    it("rejects an invalid body with a structured ApiError", async () => {
      expect.assertions(3);
      mockFetch.mockResolvedValue(jsonResponse({ value: "not-a-number" }));

      try {
        await client.get<{ value: number }>("/api/test", { schema: numberSchema });
      } catch (error) {
        expect((error as Error).message).toBe("Expected { value: number }");
        expect((error as { status: number }).status).toBe(422);
        expect((error as { code: string }).code).toBe("INVALID_RESPONSE");
      }
    });

    it("does not expose untrusted validation diagnostics", async () => {
      const secret = "validation-secret";
      mockFetch.mockResolvedValue(jsonResponse({ value: "not-a-number" }));

      const unsafeSchema = (): never => {
        throw new Error(`provider stderr bearer ${secret} at /Users/alice/.config/auth`);
      };

      await expect(client.get("/api/test", { schema: unsafeSchema })).rejects.toMatchObject({
        message: "Response validation failed",
        status: 422,
        code: "INVALID_RESPONSE",
      });
    });

    it("fails closed for command-like validator diagnostics in body requests", async () => {
      const secret = "validator-secret";
      mockFetch.mockResolvedValue(jsonResponse({ value: "not-a-number" }));
      const unsafeSchema = (): never => {
        throw new Error(`echo ${secret}`);
      };

      await expect(
        client.post(
          "/api/config/actions",
          { input: { credential: { kind: "literal", value: secret } } },
          { schema: unsafeSchema },
        ),
      ).rejects.toMatchObject({
        message: "Response validation failed",
        safeMessage: "Response validation failed",
        status: 422,
        code: "INVALID_RESPONSE",
      });
    });

    it("trusts the body shape when no schema is provided", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ value: "not-a-number" }));

      const result = await client.get<{ value: number }>("/api/test");

      expect(result).toEqual({ value: "not-a-number" });
    });
  });

  describe("request", () => {
    it("returns raw Response without parsing JSON for streaming endpoints", async () => {
      const body = new ReadableStream();
      mockFetch.mockResolvedValue(new Response(body, { status: 200 }));

      const response = await client.request("GET", "/api/review/stream", {
        params: { mode: "staged" },
      });

      expect(response).toBeInstanceOf(Response);
      expect(response.body).toBe(body);
      const [url, options] = lastCall();
      expect(url).toContain("mode=staged");
      expect(options.method).toBe("GET");
    });
  });
});
