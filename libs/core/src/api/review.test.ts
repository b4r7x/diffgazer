import { describe, expect, it, vi } from "vitest";
import {
  type CreateReviewOptions,
  createReview,
  getActiveReviewSession,
  resumeReviewStream,
} from "./review.js";
import { createMockClient as createClient } from "./test-helpers.js";

// Compile-time contract: CreateReviewOptions.lenses/profile accept only the
// domain enums, not arbitrary strings.
const _validReviewOptions: CreateReviewOptions = { lenses: ["security"], profile: "quick" };
// @ts-expect-error -- "not-a-lens" is not a LensId
const _invalidLenses: CreateReviewOptions = { lenses: ["not-a-lens"] };
// @ts-expect-error -- "not-a-profile" is not a ProfileId
const _invalidProfile: CreateReviewOptions = { profile: "not-a-profile" };
void _validReviewOptions;
void _invalidLenses;
void _invalidProfile;

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
      streamResponse([{ type: "complete", reviewId: "r1", result: reviewResult }]),
    );

    const result = await resumeReviewStream(client, {
      reviewId: "r1",
      signal,
    });

    expect(result.ok).toBe(true);
    expect(client.request).toHaveBeenCalledWith("GET", "/api/review/reviews/r1/stream", { signal });
  });

  it("resolves to err(STREAM_ERROR) when the reader fails mid-stream instead of rejecting", async () => {
    const client = createClient();
    const failingBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode('data: {"type":"review_started","reviewId":"r1"}\n\n'),
        );
      },
      pull() {
        throw new Error("connection reset mid-stream");
      },
    });
    vi.mocked(client.request).mockResolvedValue(new Response(failingBody, { status: 200 }));

    const result = await resumeReviewStream(client, { reviewId: "r1" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("STREAM_ERROR");
    }
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
    expect(client.post).toHaveBeenCalledWith(
      "/api/review/reviews",
      {
        mode: "staged",
        lenses: ["security"],
        profile: "quick",
        files: ["a.ts"],
      },
      undefined,
      expect.any(Function),
    );
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
    expect(withModeClient.get).toHaveBeenCalledWith(
      "/api/review/sessions/active",
      { mode: "staged" },
      expect.any(Function),
    );

    const withoutModeClient = createClient();
    vi.mocked(withoutModeClient.get).mockResolvedValue({ session: null });

    const withoutMode = await getActiveReviewSession(withoutModeClient);

    expect(withoutMode.session).toBeNull();
    expect(withoutModeClient.get).toHaveBeenCalledWith(
      "/api/review/sessions/active",
      undefined,
      expect.any(Function),
    );
  });

  it("validates the response shape, rejecting a session payload that drifts from the contract", async () => {
    const client = createClient();
    vi.mocked(client.get).mockResolvedValue({ session: null });

    await getActiveReviewSession(client);

    const validate = vi.mocked(client.get).mock.calls[0]?.[2];
    expect(validate).toBeDefined();
    expect(() => validate?.({ session: { reviewId: "r-1" } })).toThrow();
  });
});
