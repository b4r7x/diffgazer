import { describe, it, expect, vi } from "vitest";
import {
  getActiveReviewSession,
  resumeReviewStream,
  streamReview,
  streamReviewWithEvents,
} from "./review.js";
import type { ApiClient } from "./types.js";

function createClient(): ApiClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    stream: vi.fn(),
    request: vi.fn(),
  };
}

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
    vi.mocked(client.stream).mockRejectedValue(error);

    const result = await resumeReviewStream(client, { reviewId: "r1" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(code);
  });

  it("returns a stream error when the response has no body or the thrown value is not an Error", async () => {
    const bodylessClient = createClient();
    vi.mocked(bodylessClient.stream).mockResolvedValue(new Response(null, { status: 200 }));

    const bodylessResult = await resumeReviewStream(bodylessClient, { reviewId: "r1" });

    expect(bodylessResult.ok).toBe(false);
    if (!bodylessResult.ok) {
      expect(bodylessResult.error).toEqual({
        code: "STREAM_ERROR",
        message: "No response body",
      });
    }

    const rejectedClient = createClient();
    vi.mocked(rejectedClient.stream).mockRejectedValue("string error");

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
    vi.mocked(client.stream).mockResolvedValue(
      streamResponse([
        { type: "complete", reviewId: "r1", result: reviewResult },
      ]),
    );

    const result = await resumeReviewStream(client, {
      reviewId: "r1",
      signal,
    });

    expect(result.ok).toBe(true);
    expect(client.stream).toHaveBeenCalledWith("/api/review/reviews/r1/stream", { signal });
  });
});

describe("streamReview", () => {
  it("requests the review stream with query params", async () => {
    const client = createClient();
    const response = new Response(new ReadableStream(), { status: 200 });
    vi.mocked(client.stream).mockResolvedValue(response);

    const result = await streamReview(client, {
      mode: "staged",
      files: ["a.ts", "b.ts"],
      lenses: ["security"],
      profile: "quick",
    });

    expect(result).toBe(response);
    expect(client.stream).toHaveBeenCalledWith("/api/review/stream", {
      params: {
        mode: "staged",
        files: "a.ts,b.ts",
        lenses: "security",
        profile: "quick",
      },
      signal: undefined,
    });
  });
});

describe("streamReviewWithEvents", () => {
  it("returns a stream error when the response has no body", async () => {
    const client = createClient();
    vi.mocked(client.stream).mockResolvedValue(new Response(null, { status: 200 }));

    const result = await streamReviewWithEvents(client, { mode: "unstaged" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        code: "STREAM_ERROR",
        message: "No response body",
      });
    }
  });

  it("streams with review query params and returns the parsed result", async () => {
    const client = createClient();
    vi.mocked(client.stream).mockResolvedValue(
      streamResponse([
        { type: "complete", reviewId: "r2", result: reviewResult },
      ]),
    );

    const result = await streamReviewWithEvents(client, {
      mode: "staged",
      files: ["a.ts", "b.ts"],
      lenses: ["security"],
      profile: "quick",
    });

    expect(client.stream).toHaveBeenCalledWith("/api/review/stream", {
      params: {
        mode: "staged",
        files: "a.ts,b.ts",
        lenses: "security",
        profile: "quick",
      },
      signal: undefined,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        reviewId: "r2",
        result: reviewResult,
        agentEvents: [],
      });
    }
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
