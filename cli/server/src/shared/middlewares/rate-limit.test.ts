import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createRateLimitMiddleware, resetRateLimitsForTests } from "./rate-limit.js";

afterEach(() => {
  resetRateLimitsForTests();
  vi.useRealTimers();
});

function createApp(key: string, max: number, windowMs: number): Hono {
  const app = new Hono();
  app.post("/test", createRateLimitMiddleware(key, { maxRequests: max, windowMs }), (c) =>
    c.json({ ok: true }),
  );
  return app;
}

describe("rate limit middleware", () => {
  it("allows requests within the limit", async () => {
    const app = createApp("test:allow", 3, 60_000);

    for (let i = 0; i < 3; i++) {
      const res = await app.request("/test", { method: "POST" });
      expect(res.status).toBe(200);
    }
  });

  it("returns 429 with Retry-After after exceeding the limit", async () => {
    const app = createApp("test:exceed", 2, 60_000);

    await app.request("/test", { method: "POST" });
    await app.request("/test", { method: "POST" });

    const res = await app.request("/test", { method: "POST" });
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: { message: string; code: string } };
    expect(body.error.message).toBe("Too many requests");
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("resets the window after it expires", async () => {
    vi.useFakeTimers();
    const app = createApp("test:reset", 1, 1_000);

    const first = await app.request("/test", { method: "POST" });
    expect(first.status).toBe(200);

    const blocked = await app.request("/test", { method: "POST" });
    expect(blocked.status).toBe(429);

    vi.advanceTimersByTime(1_001);

    const afterReset = await app.request("/test", { method: "POST" });
    expect(afterReset.status).toBe(200);
  });

  it("tracks separate keys independently", async () => {
    const app = new Hono();
    app.post("/a", createRateLimitMiddleware("key:a", { maxRequests: 1, windowMs: 60_000 }), (c) =>
      c.json({ ok: true }),
    );
    app.post("/b", createRateLimitMiddleware("key:b", { maxRequests: 1, windowMs: 60_000 }), (c) =>
      c.json({ ok: true }),
    );

    await app.request("/a", { method: "POST" });
    const blockedA = await app.request("/a", { method: "POST" });
    expect(blockedA.status).toBe(429);

    const allowedB = await app.request("/b", { method: "POST" });
    expect(allowedB.status).toBe(200);
  });
});
