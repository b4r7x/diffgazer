import { describe, it, expect, vi, beforeEach } from "vitest";
import { resumeReviewStream, streamReview, streamReviewWithEvents } from "./review.js";
import type { ApiClient } from "./types.js";

vi.mock("@stargazer/core/review", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stargazer/core/review")>();
  return {
    ...actual,
    processReviewStream: vi.fn(),
  };
});

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

  it("should return ok result when stream completes successfully", async () => {
    const { processReviewStream } = await import("@stargazer/core/review");
    vi.mocked(processReviewStream).mockResolvedValue({
      ok: true,
      value: {
        result: { summary: "Good", issues: [] },
        reviewId: "r1",
        agentEvents: [],
      },
    });

    const body = new ReadableStream<Uint8Array>();
    vi.mocked(mockClient.stream).mockResolvedValue(new Response(body, { status: 200 }));

    const result = await resumeReviewStream(mockClient, { reviewId: "r1" });

    expect(result.ok).toBe(true);
  });
});

describe("streamReview", () => {
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

  it("should call client.stream with correct path and params", async () => {
    const response = new Response(new ReadableStream(), { status: 200 });
    vi.mocked(mockClient.stream).mockResolvedValue(response);

    const result = await streamReview(mockClient, { mode: "staged", files: ["a.ts", "b.ts"] });

    expect(result).toBe(response);
    expect(mockClient.stream).toHaveBeenCalledWith(
      "/api/review/stream",
      expect.objectContaining({
        params: expect.objectContaining({ mode: "staged", files: "a.ts,b.ts" }),
      })
    );
  });
});

describe("streamReviewWithEvents", () => {
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

  it("should return STREAM_ERROR when response has no body", async () => {
    vi.mocked(mockClient.stream).mockResolvedValue(new Response(null, { status: 200 }));

    const result = await streamReviewWithEvents(mockClient, { mode: "unstaged" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("STREAM_ERROR");
      expect(result.error.message).toBe("No response body");
    }
  });

  it("should call processReviewStream with reader and handlers", async () => {
    const { processReviewStream } = await import("@stargazer/core/review");
    const mockResult = {
      ok: true as const,
      value: {
        result: { summary: "OK", issues: [] },
        reviewId: "r2",
        agentEvents: [],
      },
    };
    vi.mocked(processReviewStream).mockResolvedValue(mockResult);

    const body = new ReadableStream<Uint8Array>();
    vi.mocked(mockClient.stream).mockResolvedValue(new Response(body, { status: 200 }));

    const onAgentEvent = vi.fn();
    const result = await streamReviewWithEvents(mockClient, { mode: "staged", onAgentEvent });

    expect(result.ok).toBe(true);
    expect(processReviewStream).toHaveBeenCalled();
  });
});
