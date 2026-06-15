import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { reviewRouter } from "../../features/review/router.js";
import { DEFAULT_BODY_LIMIT_KB } from "./body-limit.js";

function createReviewApp(): Hono {
  return new Hono().route("/api/review", reviewRouter);
}

function jsonRequestWithBytes(byteLength: number): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "unstaged", payload: "x".repeat(byteLength) }),
  };
}

describe("body limit route wiring", () => {
  it("rejects oversized review POST bodies and lets under-limit bodies reach later guards", async () => {
    const app = createReviewApp();

    const oversized = await app.request(
      "/api/review/reviews",
      jsonRequestWithBytes(DEFAULT_BODY_LIMIT_KB * 1024),
    );
    const oversizedBody = (await oversized.json()) as { error: { code: string } };

    expect(oversized.status).toBe(413);
    expect(oversizedBody.error.code).toBe("PAYLOAD_TOO_LARGE");

    const underLimit = await app.request(
      "/api/review/reviews",
      jsonRequestWithBytes(DEFAULT_BODY_LIMIT_KB * 1024 - 1024),
    );

    expect(underLimit.status).not.toBe(413);
  });
});
