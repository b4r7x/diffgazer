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

export const createRateLimitMiddleware = (key: string, config: RateLimitConfig) =>
  async (c: Context, next: Next): Promise<Response | void> => {
    const now = Date.now();
    const entry = getOrResetWindow(key, config.windowMs, now);
    entry.count++;

    if (entry.count > config.maxRequests) {
      const retryAfter = Math.ceil((entry.windowStart + config.windowMs - now) / 1000);
      c.header("Retry-After", String(retryAfter));
      return errorResponse(c, "Too many requests", "RATE_LIMITED", 429);
    }

    return next();
  };

export const resetRateLimitsForTests = (): void => {
  windows.clear();
};
