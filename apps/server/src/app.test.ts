import { describe, it, expect } from "vitest";
import { createApp } from "./app.js";

// getHostname is not exported, so we test host validation behavior
// through the createApp middleware via Hono's test client approach.

describe("host validation middleware", () => {
  it("should allow requests with localhost host header", async () => {
    const app = createApp();
    const res = await app.request("/api/health", {
      headers: { Host: "localhost:3000" },
    });

    // Should not be 403 (may be 404 if route doesn't match, that's fine)
    expect(res.status).not.toBe(403);
  });

  it("should allow requests with 127.0.0.1 host header", async () => {
    const app = createApp();
    const res = await app.request("/api/health", {
      headers: { Host: "127.0.0.1:3000" },
    });

    expect(res.status).not.toBe(403);
  });

  it("should allow requests with ::1 host header", async () => {
    const app = createApp();
    const res = await app.request("/api/health", {
      headers: { Host: "[::1]:3000" },
    });

    expect(res.status).not.toBe(403);
  });

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
  });

  it("should allow localhost without port", async () => {
    const app = createApp();
    const res = await app.request("/api/health", {
      headers: { Host: "localhost" },
    });

    expect(res.status).not.toBe(403);
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

    const origin = res.headers.get("Access-Control-Allow-Origin");
    expect(origin).not.toBe("https://evil.com");
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
