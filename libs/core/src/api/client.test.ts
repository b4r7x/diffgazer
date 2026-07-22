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

      await client.get("/api/reviews", { mode: "staged" });

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

      const result = await client.get<{ value: number }>("/api/test", undefined, numberSchema);

      expect(result).toEqual({ value: 42 });
    });

    it("rejects an invalid body with a structured ApiError", async () => {
      expect.assertions(3);
      mockFetch.mockResolvedValue(jsonResponse({ value: "not-a-number" }));

      try {
        await client.get<{ value: number }>("/api/test", undefined, numberSchema);
      } catch (error) {
        expect((error as Error).message).toBe("Expected { value: number }");
        expect((error as { status: number }).status).toBe(422);
        expect((error as { code: string }).code).toBe("INVALID_RESPONSE");
      }
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
