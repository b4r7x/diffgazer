import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./client.js";
import {
  type CreateReviewOptions,
  createReview,
  getActiveReviewSession,
  getReviews,
  refreshReviewContext,
  resumeReviewStream,
} from "./review.js";
import { createMockClient as createClient } from "./test-helpers.js";
import { isApiError } from "./types.js";

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

  it("resumes from the review stream endpoint and forwards step, agent, and chunk events", async () => {
    const client = createClient();
    const signal = new AbortController().signal;
    vi.mocked(client.request).mockResolvedValue(
      streamResponse([
        { type: "step_start", step: "diff", timestamp: "2025-01-01T00:00:00Z" },
        {
          type: "agent_start",
          agent: {
            id: "detective",
            name: "Detective",
            lens: "correctness",
            badgeLabel: "DET",
            badgeVariant: "info",
            description: "Finds bugs",
          },
          timestamp: "2025-01-01T00:00:00Z",
        },
        { type: "chunk", content: "partial" },
        { type: "complete", reviewId: "r1", result: reviewResult },
      ]),
    );
    const onStepEvent = vi.fn();
    const onAgentEvent = vi.fn();
    const onChunk = vi.fn();

    const result = await resumeReviewStream(client, {
      reviewId: "r1",
      signal,
      onStepEvent,
      onAgentEvent,
      onChunk,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ reviewId: "r1", result: reviewResult });
    }
    expect(client.request).toHaveBeenCalledWith("GET", "/api/review/reviews/r1/stream", { signal });
    expect(onStepEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "step_start", step: "diff" }),
    );
    expect(onAgentEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "agent_start" }));
    expect(onChunk).toHaveBeenCalledWith("partial");
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
  it("creates a review with the supplied mode, lenses, profile, and files and returns the new session", async () => {
    const client = createClient();
    const session = {
      reviewId: "11111111-1111-4111-8111-111111111111",
      mode: "staged",
      startedAt: "2026-01-01T00:00:00.000Z",
      headCommit: "abc123",
      statusHash: "hash123",
    };
    vi.mocked(client.post).mockResolvedValue({ reviewId: session.reviewId, session });

    const result = await createReview(client, {
      mode: "staged",
      lenses: ["security"],
      profile: "quick",
      files: ["a.ts"],
    });

    expect(result).toEqual({ reviewId: session.reviewId, session });
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

  it("normalizes invalid create-review payloads into ApiError", async () => {
    const reviewId = "11111111-1111-4111-8111-111111111111";
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ reviewId }));
    const originalFetch = globalThis.fetch;
    vi.stubGlobal("fetch", fetchMock);

    const client = createApiClient({ baseUrl: "http://localhost:3000" });
    let error: unknown;
    try {
      await createReview(client, { mode: "staged" });
    } catch (caught) {
      error = caught;
    } finally {
      vi.stubGlobal("fetch", originalFetch);
    }

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/review/reviews",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ mode: "staged" }),
      }),
    );
    expect(isApiError(error)).toBe(true);
    if (!isApiError(error)) throw new Error("Expected ApiError");
    expect(error.status).toBe(422);
    expect(error.code).toBe("INVALID_RESPONSE");
  });
});

describe("getReviews", () => {
  it("forwards the project, cursor, and page size to the validated list endpoint", async () => {
    const client = createClient();
    vi.mocked(client.get).mockResolvedValue({ reviews: [], nextCursor: null });
    const cursor = "dg1_eyJvcGFxdWUiOiJjdXJzb3IifQ";

    await getReviews(client, "/repo", cursor, 25);

    expect(client.get).toHaveBeenCalledWith(
      "/api/review/reviews",
      { projectPath: "/repo", cursor, limit: "25" },
      expect.any(Function),
    );
  });
});

describe("getActiveReviewSession", () => {
  it("fetches the active session with or without a mode filter", async () => {
    const withModeClient = createClient();
    const signal = new AbortController().signal;
    vi.mocked(withModeClient.get).mockResolvedValue({
      session: {
        reviewId: "11111111-1111-4111-8111-111111111111",
        mode: "staged",
        startedAt: new Date().toISOString(),
        headCommit: "abc123",
        statusHash: "hash123",
      },
    });

    const withMode = await getActiveReviewSession(withModeClient, "staged", signal);

    expect(withMode.session?.reviewId).toBe("11111111-1111-4111-8111-111111111111");
    expect(withModeClient.get).toHaveBeenCalledWith(
      "/api/review/sessions/active",
      { mode: "staged" },
      expect.any(Function),
      { signal },
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

  it("normalizes invalid active-session payloads into ApiError", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ session: { reviewId: "r-1" } }));
    const originalFetch = globalThis.fetch;
    vi.stubGlobal("fetch", fetchMock);

    const client = createApiClient({ baseUrl: "http://localhost:3000" });
    const signal = new AbortController().signal;
    let error: unknown;
    try {
      await getActiveReviewSession(client, "staged", signal);
    } catch (caught) {
      error = caught;
    } finally {
      vi.stubGlobal("fetch", originalFetch);
    }

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/review/sessions/active?mode=staged",
      expect.objectContaining({ method: "GET", signal }),
    );
    expect(isApiError(error)).toBe(true);
    if (!isApiError(error)) throw new Error("Expected ApiError");
    expect(error.status).toBe(422);
    expect(error.code).toBe("INVALID_RESPONSE");
  });
});

describe("refreshReviewContext", () => {
  it("posts the force flag to the context refresh endpoint", async () => {
    const client = createClient();
    const response = {
      text: "root",
      markdown: "# root",
      graph: {
        generatedAt: "2025-01-01T00:00:00Z",
        root: "/repo",
        packages: [],
        edges: [],
        fileTree: [],
        changedFiles: [],
      },
      meta: {
        generatedAt: "2025-01-01T00:00:00Z",
        root: "/repo",
        statusHash: "hash",
        statusHashKind: "full" as const,
        charCount: 6,
      },
    };
    vi.mocked(client.post).mockResolvedValue(response);

    const result = await refreshReviewContext(client, { force: true });

    expect(result).toEqual(response);
    expect(client.post).toHaveBeenCalledWith("/api/review/context/refresh", { force: true });
  });
});
