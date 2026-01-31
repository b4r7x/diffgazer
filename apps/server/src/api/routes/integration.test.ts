import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createServer } from "../../app.js";

/**
 * Integration tests for server middleware and security
 * These tests verify the server's security middleware works correctly
 * without needing to mock all the underlying services.
 */
describe("Server Integration Tests", () => {
  const app = createServer();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Health endpoint", () => {
    it("should return 200 OK on /health from localhost", async () => {
      const res = await app.request("/health", {
        headers: { host: "localhost:3000" },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("status", "ok");
    });

    it("should return 200 OK on /health from 127.0.0.1", async () => {
      const res = await app.request("/health", {
        headers: { host: "127.0.0.1:3000" },
      });
      expect(res.status).toBe(200);
    });
  });

  describe("Security middleware", () => {
    it("should reject requests from non-localhost hosts", async () => {
      const res = await app.request("/health", {
        headers: { host: "evil.com:3000" },
      });
      expect(res.status).toBe(403);
    });

    it("should reject requests from arbitrary hosts", async () => {
      const res = await app.request("/health", {
        headers: { host: "attacker.example.com" },
      });
      expect(res.status).toBe(403);
    });

    it("should set security headers on responses", async () => {
      const res = await app.request("/health", {
        headers: { host: "localhost:3000" },
      });
      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });
  });

  describe("CORS", () => {
    it("should allow CORS from localhost origins", async () => {
      const res = await app.request("/health", {
        headers: {
          host: "localhost:3000",
          origin: "http://localhost:5173",
        },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    });

    it("should reject CORS from non-localhost origins", async () => {
      const res = await app.request("/health", {
        headers: {
          host: "localhost:3000",
          origin: "http://evil.com",
        },
      });
      expect(res.status).toBe(200);
      // Non-localhost origin should not get CORS headers
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeFalsy();
    });
  });

  describe("Error handling", () => {
    it("should return 404 for unknown routes", async () => {
      const res = await app.request("/unknown-route-that-does-not-exist", {
        headers: { host: "localhost:3000" },
      });
      expect(res.status).toBe(404);
      const data = (await res.json()) as { error: { code: string; message: string } };
      expect(data).toHaveProperty("error");
      expect(data.error).toHaveProperty("code", "NOT_FOUND");
    });

    it("should return JSON error format", async () => {
      const res = await app.request("/nonexistent", {
        headers: { host: "localhost:3000" },
      });
      const data = (await res.json()) as { error: { code: string; message: string } };
      expect(data).toHaveProperty("error");
      expect(data.error).toHaveProperty("message");
      expect(data.error).toHaveProperty("code");
    });
  });
});
