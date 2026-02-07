import { describe, it, expect, vi, beforeEach } from "vitest";
import { resumeReviewStream } from "./review.js";
import type { ApiClient } from "./types.js";

describe("resumeReviewStream", () => {
  let mockClient: ApiClient;

  beforeEach(() => {
    mockClient = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      stream: vi.fn(),
      request: vi.fn(),
    };
  });

  it("returns NOT_FOUND error on 404 status", async () => {
    const error = new Error("Session not found") as Error & { status: number };
    error.status = 404;
    vi.mocked(mockClient.stream).mockRejectedValue(error);

    const result = await resumeReviewStream(mockClient, { reviewId: "r1" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SESSION_NOT_FOUND");
    }
  });

  it("returns SESSION_STALE error on 409 status", async () => {
    const error = new Error("Session is stale") as Error & { status: number };
    error.status = 409;
    vi.mocked(mockClient.stream).mockRejectedValue(error);

    const result = await resumeReviewStream(mockClient, { reviewId: "r1" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SESSION_STALE");
    }
  });

  it("returns STREAM_ERROR on other error statuses", async () => {
    const error = new Error("Internal error") as Error & { status: number };
    error.status = 500;
    vi.mocked(mockClient.stream).mockRejectedValue(error);

    const result = await resumeReviewStream(mockClient, { reviewId: "r1" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("STREAM_ERROR");
    }
  });

  it("returns STREAM_ERROR when response has no body", async () => {
    vi.mocked(mockClient.stream).mockResolvedValue(
      new Response(null, { status: 200 })
    );

    const result = await resumeReviewStream(mockClient, { reviewId: "r1" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("STREAM_ERROR");
      expect(result.error.message).toBe("No response body");
    }
  });

  it("returns STREAM_ERROR for non-Error thrown values", async () => {
    vi.mocked(mockClient.stream).mockRejectedValue("string error");

    const result = await resumeReviewStream(mockClient, { reviewId: "r1" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("STREAM_ERROR");
    }
  });
});
