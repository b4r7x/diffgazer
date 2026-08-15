import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./client.js";
import {
  bindReview,
  type CreateReviewOptions,
  createReview,
  getActiveReviewSession,
  getReviewContext,
  getReviews,
  REVIEW_CONTEXT_RESPONSE_MAX_BYTES,
  REVIEWS_LIST_RESPONSE_MAX_BYTES,
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
// @ts-expect-error -- mode "files" requires a non-empty files[]
const _filesModeWithoutFiles: CreateReviewOptions = { mode: "files" };
// @ts-expect-error -- mode "files" rejects an empty files[]
const _filesModeWithEmptyFiles: CreateReviewOptions = { mode: "files", files: [] };
const _filesMode: CreateReviewOptions = { mode: "files", files: ["src/index.ts"] };
void _validReviewOptions;
void _invalidLenses;
void _invalidProfile;
void _filesModeWithoutFiles;
void _filesModeWithEmptyFiles;
void _filesMode;

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
    const error = Object.assign(new Error("Request failed"), { status });
    vi.mocked(client.request).mockRejectedValue(error);

    const result = await resumeReviewStream(client, { reviewId: "r1" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(code);
  });

  it("maps HTTP 403 TRUST_REQUIRED to TRUST_REQUIRED instead of STREAM_ERROR", async () => {
    const client = createClient();
    const error = Object.assign(new Error("Repository access not granted"), {
      status: 403,
      code: "TRUST_REQUIRED",
    });
    vi.mocked(client.request).mockRejectedValue(error);

    const result = await resumeReviewStream(client, { reviewId: "r1" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TRUST_REQUIRED");
      expect(result.error.message).toBe("Repository access not granted");
    }
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

  it("releases the body and cancels the source when a chunk handler throws", async () => {
    const client = createClient();
    let cancelCount = 0;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"type":"chunk","content":"x"}\n\n'));
      },
      cancel() {
        cancelCount += 1;
      },
    });
    const response = new Response(body, { status: 200 });
    vi.mocked(client.request).mockResolvedValue(response);

    const result = await resumeReviewStream(client, {
      reviewId: "r1",
      onChunk: () => {
        throw new Error("handler exploded");
      },
    });

    expect(result.ok).toBe(false);
    expect(response.body?.locked).toBe(false);
    expect(cancelCount).toBe(1);
  });

  it("releases the body lock after a stream completes normally", async () => {
    const client = createClient();
    const response = streamResponse([{ type: "complete", reviewId: "r1", result: reviewResult }]);
    vi.mocked(client.request).mockResolvedValue(response);

    const result = await resumeReviewStream(client, { reviewId: "r1" });

    expect(result.ok).toBe(true);
    expect(response.body?.locked).toBe(false);
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
      { schema: expect.any(Function) },
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
  it("forwards the cursor to the validated list endpoint", async () => {
    const client = createClient();
    vi.mocked(client.get).mockResolvedValue({ reviews: [], nextCursor: null });
    const cursor = "dg1_eyJvcGFxdWUiOiJjdXJzb3IifQ";

    await getReviews(client, cursor);

    expect(client.get).toHaveBeenCalledWith("/api/review/reviews", {
      maxResponseBytes: REVIEWS_LIST_RESPONSE_MAX_BYTES,
      params: { cursor },
      schema: expect.any(Function),
    });
  });

  it("omits the cursor param on the first page", async () => {
    const client = createClient();
    vi.mocked(client.get).mockResolvedValue({ reviews: [], nextCursor: null });

    await getReviews(client);

    expect(client.get).toHaveBeenCalledWith("/api/review/reviews", {
      maxResponseBytes: REVIEWS_LIST_RESPONSE_MAX_BYTES,
      params: {},
      schema: expect.any(Function),
    });
  });
});

describe("getReview", () => {
  const reviewId = "11111111-1111-4111-8111-111111111111";

  function savedReviewBody(issueCount: number): string {
    const issues = Array.from({ length: issueCount }, (_, index) => ({
      id: `issue-${index}`,
      severity: "high",
      category: "correctness",
      title: `Finding ${index}`,
      file: "src/index.ts",
      line_start: 1,
      line_end: 2,
      rationale: "r".repeat(400),
      recommendation: "c".repeat(400),
      suggested_patch: "p".repeat(800),
      confidence: 0.9,
      symptom: "s".repeat(200),
      whyItMatters: "w".repeat(200),
      evidence: [],
    }));

    return JSON.stringify({
      review: {
        metadata: {
          id: reviewId,
          projectPath: "/repo",
          createdAt: "2025-01-01T00:00:00.000Z",
          mode: "staged",
          branch: "main",
          profile: "quick",
          lenses: ["security"],
          issueCount,
          fileCount: 1,
        },
        result: { issues },
        gitContext: {
          branch: "main",
          commit: "abc123",
          fileCount: 1,
          additions: 10,
          deletions: 2,
        },
      },
    });
  }

  it("reads a stored review whose findings exceed the default capture bound", async () => {
    const body = savedReviewBody(60);
    expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(64 * 1024);

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const originalFetch = globalThis.fetch;
    vi.stubGlobal("fetch", fetchMock);

    const api = bindReview(createApiClient({ baseUrl: "http://localhost:3000" }));
    try {
      const response = await api.getReview(reviewId);
      expect(response.review.result.issues).toHaveLength(60);
    } finally {
      vi.stubGlobal("fetch", originalFetch);
    }
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
    expect(withModeClient.get).toHaveBeenCalledWith("/api/review/sessions/active", {
      params: { mode: "staged" },
      signal,
      schema: expect.any(Function),
    });

    const withoutModeClient = createClient();
    vi.mocked(withoutModeClient.get).mockResolvedValue({ session: null });

    const withoutMode = await getActiveReviewSession(withoutModeClient);

    expect(withoutMode.session).toBeNull();
    expect(withoutModeClient.get).toHaveBeenCalledWith("/api/review/sessions/active", {
      schema: expect.any(Function),
    });
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

describe("getReviewContext", () => {
  it("requests a raised capture bound for large context envelopes", async () => {
    const client = createClient();
    const response = {
      text: "x".repeat(40_000),
      markdown: "m".repeat(40_000),
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
        charCount: 40_000,
      },
    };
    vi.mocked(client.get).mockResolvedValue(response);

    await expect(getReviewContext(client)).resolves.toEqual(response);
    expect(client.get).toHaveBeenCalledWith("/api/review/context", {
      maxResponseBytes: REVIEW_CONTEXT_RESPONSE_MAX_BYTES,
      schema: expect.any(Function),
    });
  });

  it("normalizes malformed context payloads into ApiError", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({}));
    const originalFetch = globalThis.fetch;
    vi.stubGlobal("fetch", fetchMock);

    const client = createApiClient({ baseUrl: "http://localhost:3000" });
    let error: unknown;
    try {
      await getReviewContext(client);
    } catch (caught) {
      error = caught;
    } finally {
      vi.stubGlobal("fetch", originalFetch);
    }

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
    expect(client.post).toHaveBeenCalledWith(
      "/api/review/context/refresh",
      { force: true },
      {
        maxResponseBytes: REVIEW_CONTEXT_RESPONSE_MAX_BYTES,
        schema: expect.any(Function),
      },
    );
  });

  it("normalizes malformed refresh payloads into ApiError", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ text: "only-text" }));
    const originalFetch = globalThis.fetch;
    vi.stubGlobal("fetch", fetchMock);

    const client = createApiClient({ baseUrl: "http://localhost:3000" });
    let error: unknown;
    try {
      await refreshReviewContext(client, { force: true });
    } catch (caught) {
      error = caught;
    } finally {
      vi.stubGlobal("fetch", originalFetch);
    }

    expect(isApiError(error)).toBe(true);
    if (!isApiError(error)) throw new Error("Expected ApiError");
    expect(error.status).toBe(422);
    expect(error.code).toBe("INVALID_RESPONSE");
  });
});
