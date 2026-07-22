import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { configRouter } from "../../features/config/router.js";
import { reviewRouter } from "../../features/review/router.js";
import { DEFAULT_BODY_LIMIT_KB } from "./body-limit.js";

function createReviewApp(): Hono {
  return new Hono().route("/api/review", reviewRouter).route("/api/config", configRouter);
}

function jsonRequestWithBytes(byteLength: number): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "unstaged", payload: "x".repeat(byteLength) }),
  };
}

describe("body limit route wiring", () => {
  it("uses the review-specific cap without changing the default JSON route cap", async () => {
    const app = createReviewApp();

    const reviewAboveDefault = await app.request(
      "/api/review/reviews",
      jsonRequestWithBytes(DEFAULT_BODY_LIMIT_KB * 1024),
    );
    expect(reviewAboveDefault.status).not.toBe(413);

    const oversizedConfig = await app.request(
      "/api/config",
      jsonRequestWithBytes(DEFAULT_BODY_LIMIT_KB * 1024),
    );
    const oversizedBody = (await oversizedConfig.json()) as { error: { code: string } };

    expect(oversizedConfig.status).toBe(413);
    expect(oversizedBody.error.code).toBe("PAYLOAD_TOO_LARGE");
  });
});
