import type { Context, Next } from "hono";
import { errorResponse } from "../lib/http/response.js";

interface WindowEntry {
  count: number;
  windowStart: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

type MonotonicNow = () => number;

const windows = new Map<string, WindowEntry>();

const getOrResetWindow = (key: string, windowMs: number, now: number): WindowEntry => {
  const entry = windows.get(key);
  if (entry && now - entry.windowStart < windowMs) {
    return entry;
  }
  const fresh: WindowEntry = { count: 0, windowStart: now };
  windows.set(key, fresh);
  return fresh;
};

export const createRateLimitMiddleware =
  (key: string, config: RateLimitConfig, now: MonotonicNow = () => performance.now()) =>
  async (c: Context, next: Next): Promise<Response | undefined> => {
    const currentTime = now();
    const entry = getOrResetWindow(key, config.windowMs, currentTime);
    entry.count++;

    if (entry.count > config.maxRequests) {
      const remainingMs = Math.min(
        config.windowMs,
        Math.max(0, entry.windowStart + config.windowMs - currentTime),
      );
      const retryAfter = Math.max(1, Math.ceil(remainingMs / 1000));
      c.header("Retry-After", String(retryAfter));
      return errorResponse(c, "Too many requests", "RATE_LIMITED", 429);
    }

    await next();
    return undefined;
  };

export const resetRateLimitsForTests = (): void => {
  windows.clear();
};
