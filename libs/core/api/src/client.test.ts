import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApiClient } from "./client.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function lastCall() {
  const call = mockFetch.mock.calls[0];
  if (!call) throw new Error("No fetch calls recorded");
  return call as [string, RequestInit];
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
        expect.any(Object)
      );
    });

    it("normalizes trailing slash on baseUrl", async () => {
      const slashClient = createApiClient({ baseUrl: "http://localhost:3000/" });
      mockFetch.mockResolvedValue(jsonResponse({}));

      await slashClient.get("/api/test");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/test",
        expect.any(Object)
      );
    });

    it("normalizes path without leading slash", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));

      await client.get("api/test");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/test",
        expect.any(Object)
      );
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

      const [, options] = lastCall();
      expect((options.headers as Record<string, string>).Accept).toBe("application/json");
    });

    it("sets Content-Type on POST requests with body", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));

      await client.post("/api/test", { data: 1 });

      const [, options] = lastCall();
      expect((options.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    });

    it("does not set Content-Type on GET requests", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));

      await client.get("/api/test");

      const [, options] = lastCall();
      expect((options.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
    });

    it("includes projectRoot header when configured", async () => {
      const projectClient = createApiClient({
        baseUrl: "http://localhost:3000",
        projectRoot: "/home/user/project",
      });
      mockFetch.mockResolvedValue(jsonResponse({}));

      await projectClient.get("/api/test");

      const [, options] = lastCall();
      expect((options.headers as Record<string, string>)["x-diffgazer-project-root"]).toBe("/home/user/project");
    });

    it("includes custom base headers", async () => {
      const customClient = createApiClient({
        baseUrl: "http://localhost:3000",
        headers: { "X-Custom": "value" },
      });
      mockFetch.mockResolvedValue(jsonResponse({}));

      await customClient.get("/api/test");

      const [, options] = lastCall();
      expect((options.headers as Record<string, string>)["X-Custom"]).toBe("value");
    });
  });

  describe("HTTP methods", () => {
    it("GET sends no body", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ items: [] }));

      const result = await client.get<{ items: string[] }>("/api/list");

      expect(result).toEqual({ items: [] });
      const [, options] = lastCall();
      expect(options.method).toBe("GET");
      expect(options.body).toBeUndefined();
    });

    it("POST sends JSON body", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ id: "1" }));

      await client.post("/api/create", { name: "test" });

      const [, options] = lastCall();
      expect(options.method).toBe("POST");
      expect(options.body).toBe(JSON.stringify({ name: "test" }));
    });

    it("PUT sends JSON body", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ updated: true }));

      await client.put("/api/update", { name: "new" });

      const [, options] = lastCall();
      expect(options.method).toBe("PUT");
    });

    it("DELETE sends no body", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ deleted: true }));

      const result = await client.delete<{ deleted: boolean }>("/api/item/1");

      expect(result).toEqual({ deleted: true });
      const [, options] = lastCall();
      expect(options.method).toBe("DELETE");
    });
  });

  describe("error handling", () => {
    it("throws ApiError with message from response body", async () => {
      mockFetch.mockResolvedValue(
        errorResponse(400, { error: { message: "Invalid input", code: "VALIDATION" } })
      );

      await expect(client.get("/api/test")).rejects.toThrow("Invalid input");
    });

    it("throws ApiError with status code", async () => {
      expect.assertions(1);
      mockFetch.mockResolvedValue(
        errorResponse(404, { error: { message: "Not found" } })
      );

      try {
        await client.get("/api/test");
      } catch (error) {
        expect((error as { status: number }).status).toBe(404);
      }
    });

    it("throws ApiError with error code from body", async () => {
      expect.assertions(1);
      mockFetch.mockResolvedValue(
        errorResponse(409, { error: { message: "Conflict", code: "SESSION_STALE" } })
      );

      try {
        await client.get("/api/test");
      } catch (error) {
        expect((error as { code: string }).code).toBe("SESSION_STALE");
      }
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
      mockFetch.mockResolvedValue(new Response("not json", { status: 200, headers: { "Content-Type": "text/plain" } }));

      await expect(client.get("/api/test")).rejects.toThrow("Invalid JSON response");
    });
  });

  describe("stream", () => {
    it("should return raw Response without parsing JSON", async () => {
      const body = new ReadableStream();
      mockFetch.mockResolvedValue(new Response(body, { status: 200 }));

      const response = await client.stream("/api/review/stream", { params: { mode: "staged" } });

      expect(response).toBeInstanceOf(Response);
      expect(response.body).toBe(body);
      const [url, options] = lastCall();
      expect(url).toContain("mode=staged");
      expect(options.method).toBe("GET");
    });
  });
});
