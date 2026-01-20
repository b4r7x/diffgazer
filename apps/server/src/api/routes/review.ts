import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { createAIClient } from "@repo/core/ai";
import { readConfig } from "@repo/core/storage";
import { getApiKey } from "@repo/core/secrets";
import { reviewDiff } from "../../services/review.js";
import { ReviewResultSchema } from "@repo/schemas/review";

const review = new Hono();

// In-memory rate limiter: 10 requests per minute per IP
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

/**
 * Check rate limit and increment counter atomically.
 * Uses passive cleanup - expired entries are removed on access.
 * This avoids memory leaks from setInterval and race conditions from
 * separate read/check/write operations.
 */
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  // Expired or new entry - reset and allow
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  // Atomic check-and-increment: only increment if under limit
  if (entry.count < RATE_LIMIT_MAX) {
    entry.count++;
    return true;
  }

  // Rate limit exceeded
  return false;
}

review.get("/stream", async (c) => {
  // Rate limiting check
  // This server binds to 127.0.0.1 only (local CLI tool) - no proxy headers needed
  // Using fixed identifier prevents IP spoofing via x-forwarded-for/x-real-ip headers
  const clientIP = "localhost";

  if (!checkRateLimit(clientIP)) {
    return c.json(
      {
        success: false,
        error: {
          message: "Rate limit exceeded. Please try again later.",
          code: "RATE_LIMITED",
        },
      },
      429
    );
  }

  const configResult = await readConfig();
  if (!configResult.ok) {
    return c.json(
      {
        success: false,
        error: {
          message: "AI provider not configured. Please configure in settings.",
          code: "API_KEY_MISSING",
        },
      },
      500
    );
  }

  const config = configResult.value;
  const apiKeyResult = await getApiKey(config.provider);

  if (!apiKeyResult.ok || !apiKeyResult.value) {
    return c.json(
      {
        success: false,
        error: {
          message: `API key not found for provider '${config.provider}'. Please configure in settings.`,
          code: "API_KEY_MISSING",
        },
      },
      500
    );
  }

  const clientResult = createAIClient(config.provider, {
    apiKey: apiKeyResult.value,
    model: config.model,
  });

  if (!clientResult.ok) {
    return c.json(
      {
        success: false,
        error: { message: clientResult.error.message, code: "AI_ERROR" },
      },
      500
    );
  }

  const staged = c.req.query("staged") !== "false";

  return streamSSE(c, async (stream) => {
    await reviewDiff(clientResult.value, staged, {
      onChunk: async (chunk) => {
        await stream.writeSSE({
          event: "chunk",
          data: JSON.stringify({ type: "chunk", content: chunk }),
        });
      },
      onComplete: async (content) => {
        try {
          const parsed = JSON.parse(content);
          const validated = ReviewResultSchema.safeParse(parsed);
          const result = validated.success
            ? validated.data
            : { summary: content, issues: [] };
          await stream.writeSSE({
            event: "complete",
            data: JSON.stringify({ type: "complete", result }),
          });
        } catch {
          await stream.writeSSE({
            event: "complete",
            data: JSON.stringify({
              type: "complete",
              result: { summary: content, issues: [] },
            }),
          });
        }
        stream.close();
      },
      onError: async (error) => {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({
            type: "error",
            error: { message: error.message, code: "AI_ERROR" },
          }),
        });
        stream.close();
      },
    });
  });
});

export { review };
