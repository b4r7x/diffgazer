import { describe, it, expect, vi } from "vitest";
import {
  createReview,
  getActiveReviewSession,
  resumeReviewStream,
} from "./review.js";
import type { ApiClient } from "./types.js";
import { createMockClient as createClient } from "../testing/factories.js";

function streamResponse(events: unknown[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
        controller.close();
      },
    }),
    { status: 200 },
  );
}

const reviewResult = {
  summary: "No issues found",
  issues: [],
};

describe("resumeReviewStream", () => {
  it.each([
    [404, "SESSION_NOT_FOUND"],
    [409, "SESSION_STALE"],
    [500, "STREAM_ERROR"],
  ])("maps HTTP %s failures to %s", async (status, code) => {
    const client = createClient();
    const error = new Error("Request failed") as Error & { status: number };
    error.status = status;
    vi.mocked(client.request).mockRejectedValue(error);

    const result = await resumeReviewStream(client, { reviewId: "r1" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(code);
  });

  it("returns a stream error when the response has no body or the thrown value is not an Error", async () => {
    const bodylessClient = createClient();
    vi.mocked(bodylessClient.request).mockResolvedValue(new Response(null, { status: 200 }));

    const bodylessResult = await resumeReviewStream(bodylessClient, { reviewId: "r1" });

    expect(bodylessResult.ok).toBe(false);
    if (!bodylessResult.ok) {
      expect(bodylessResult.error).toEqual({
        code: "STREAM_ERROR",
        message: "No response body",
      });
    }

    const rejectedClient = createClient();
    vi.mocked(rejectedClient.request).mockRejectedValue("string error");

    const rejectedResult = await resumeReviewStream(rejectedClient, { reviewId: "r1" });

    expect(rejectedResult.ok).toBe(false);
    if (!rejectedResult.ok) {
      expect(rejectedResult.error).toEqual({
        code: "STREAM_ERROR",
        message: "string error",
      });
    }
  });

  it("resumes from the review stream endpoint", async () => {
    const client = createClient();
    const signal = new AbortController().signal;
    vi.mocked(client.request).mockResolvedValue(
      streamResponse([
        { type: "complete", reviewId: "r1", result: reviewResult },
      ]),
    );

    const result = await resumeReviewStream(client, {
      reviewId: "r1",
      signal,
    });

    expect(result.ok).toBe(true);
    expect(client.request).toHaveBeenCalledWith("GET", "/api/review/reviews/r1/stream", { signal });
  });
});

describe("createReview", () => {
  it("creates a review with the supplied mode, lenses, profile, and files and returns the new id", async () => {
    const client = createClient();
    vi.mocked(client.post).mockResolvedValue({ reviewId: "new-review-id" });

    const result = await createReview(client, {
      mode: "staged",
      lenses: ["security"],
      profile: "quick",
      files: ["a.ts"],
    });

    expect(result).toEqual({ reviewId: "new-review-id" });
    expect(client.post).toHaveBeenCalledWith("/api/review/reviews", {
      mode: "staged",
      lenses: ["security"],
      profile: "quick",
      files: ["a.ts"],
    });
  });
});

describe("getActiveReviewSession", () => {
  it("fetches the active session with or without a mode filter", async () => {
    const withModeClient = createClient();
    vi.mocked(withModeClient.get).mockResolvedValue({
      session: {
        reviewId: "r-1",
        mode: "staged",
        startedAt: new Date().toISOString(),
        headCommit: "abc123",
        statusHash: "hash123",
      },
    });

    const withMode = await getActiveReviewSession(withModeClient, "staged");

    expect(withMode.session?.reviewId).toBe("r-1");
    expect(withModeClient.get).toHaveBeenCalledWith("/api/review/sessions/active", {
      mode: "staged",
    });

    const withoutModeClient = createClient();
    vi.mocked(withoutModeClient.get).mockResolvedValue({ session: null });

    const withoutMode = await getActiveReviewSession(withoutModeClient);

    expect(withoutMode.session).toBeNull();
    expect(withoutModeClient.get).toHaveBeenCalledWith("/api/review/sessions/active", undefined);
  });
});
