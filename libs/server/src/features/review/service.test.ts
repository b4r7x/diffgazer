import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SSEWriter } from "../../shared/lib/http/types.js";
import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import { ok } from "@diffgazer/core/result";

vi.mock("./pipeline.js", () => ({
  resolveGitDiff: vi.fn(),
  resolveReviewConfig: vi.fn(),
  executeReview: vi.fn(),
  finalizeReview: vi.fn(),
}));

vi.mock("../../shared/lib/git/service.js", () => ({
  createGitService: vi.fn(),
}));

import {
  streamActiveSessionToSSE,
  streamReviewToSSE,
} from "./service.js";
import {
  addEvent,
  createSession,
  deleteSession,
  getSession,
  markComplete,
  markReady,
} from "./sessions.js";
import {
  executeReview,
  finalizeReview,
  resolveGitDiff,
  resolveReviewConfig,
} from "./pipeline.js";
import { createGitService } from "../../shared/lib/git/service.js";

type GitService = ReturnType<typeof createGitService>;

const createdSessionIds = new Set<string>();

function trackSession(reviewId: string): void {
  createdSessionIds.add(reviewId);
}

function cleanupTrackedSessions(): void {
  for (const id of createdSessionIds) {
    deleteSession(id);
  }
  createdSessionIds.clear();
}

function makeMockStream(): SSEWriter & { events: Array<{ event: string; data: string }> } {
  const events: Array<{ event: string; data: string }> = [];
  return {
    events,
    writeSSE: vi.fn(async (payload: { event: string; data: string }) => {
      events.push(payload);
      const parsed = JSON.parse(payload.data) as FullReviewStreamEvent;
      if ("reviewId" in parsed && typeof parsed.reviewId === "string") {
        trackSession(parsed.reviewId);
      }
    }),
  };
}

function parsedEvents(stream: { events: Array<{ data: string }> }): FullReviewStreamEvent[] {
  return stream.events.map((event) => JSON.parse(event.data) as FullReviewStreamEvent);
}

function makeGitService(): GitService {
  return {
    getStatus: async () => ({
      isGitRepo: true,
      branch: "main",
      remoteBranch: null,
      ahead: 0,
      behind: 0,
      files: { staged: [], unstaged: [], untracked: [] },
      hasChanges: false,
      conflicted: [],
    }),
    getDiff: async () => "",
    isGitInstalled: async () => true,
    getBlame: async () => null,
    getFileLines: async () => [],
    getHeadCommit: async () => ok("abc123"),
    getStatusHash: async () => "hash123",
  };
}

function mockSuccessfulPipeline(): void {
  const parsedDiff = {
    files: [],
    totalStats: { filesChanged: 0, additions: 0, deletions: 0, totalSizeBytes: 0 },
  };
  vi.mocked(resolveGitDiff).mockResolvedValue(ok(parsedDiff));
  vi.mocked(resolveReviewConfig).mockResolvedValue({
    activeLenses: ["correctness"],
    profile: undefined,
    projectContext: "",
  });
  vi.mocked(executeReview).mockResolvedValue(ok({ issues: [], summary: "Clean" }));
  vi.mocked(finalizeReview).mockResolvedValue(ok({ issues: [], summary: "Clean" }));
}

describe("streamActiveSessionToSSE", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanupTrackedSessions();
    vi.useRealTimers();
  });

  it("replays buffered events to the SSE stream", async () => {
    const stream = makeMockStream();
    const session = createSession("replay-session", "/project", "abc123", "hash123", "unstaged");
    trackSession(session.reviewId);
    const events: FullReviewStreamEvent[] = [
      { type: "step_start", step: "diff", timestamp: new Date().toISOString() },
      { type: "complete", result: { issues: [], summary: "Clean" }, reviewId: session.reviewId, durationMs: 100 },
    ];
    session.events.push(...events);
    session.isComplete = true;

    await streamActiveSessionToSSE(stream, session);

    expect(parsedEvents(stream)).toEqual(events);
  });

  it("streams live events until a terminal event arrives", async () => {
    const stream = makeMockStream();
    const session = createSession("live-session", "/project", "abc123", "hash123", "unstaged");
    trackSession(session.reviewId);

    const replay = streamActiveSessionToSSE(stream, session);
    addEvent(session.reviewId, {
      type: "complete",
      result: { issues: [], summary: "Clean" },
      reviewId: session.reviewId,
      durationMs: 50,
    });

    await replay;

    expect(parsedEvents(stream)).toMatchObject([
      { type: "complete", reviewId: session.reviewId },
    ]);
  });

  it("writes a stale error when the session cannot be subscribed", async () => {
    const stream = makeMockStream();
    const session = createSession("stale-session", "/project", "abc123", "hash123", "unstaged");
    trackSession(session.reviewId);
    deleteSession(session.reviewId);

    await streamActiveSessionToSSE(stream, session);

    expect(parsedEvents(stream)).toMatchObject([
      { type: "error", error: { code: ReviewErrorCode.SESSION_STALE } },
    ]);
  });

  it("stops without writing when the client aborts", async () => {
    const stream = makeMockStream();
    const session = createSession("abort-session", "/project", "abc123", "hash123", "unstaged");
    const controller = new AbortController();
    trackSession(session.reviewId);

    const replay = streamActiveSessionToSSE(stream, session, controller.signal);
    controller.abort();

    await replay;

    expect(stream.events).toEqual([]);
  });

  it("writes a terminal event discovered after subscription", async () => {
    vi.useFakeTimers();
    const stream = makeMockStream();
    const session = createSession("poll-session", "/project", "abc123", "hash123", "unstaged");
    trackSession(session.reviewId);

    const replay = streamActiveSessionToSSE(stream, session);
    session.events.push({
      type: "complete",
      result: { issues: [], summary: "Clean" },
      reviewId: session.reviewId,
      durationMs: 200,
    });
    session.isComplete = true;

    await vi.advanceTimersByTimeAsync(250);
    await replay;

    expect(parsedEvents(stream)).toMatchObject([
      { type: "complete", reviewId: session.reviewId },
    ]);
  });
});

describe("streamReviewToSSE", () => {
  const mockAIClient = {
    provider: "openrouter" as const,
    generate: vi.fn(),
    generateStream: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createGitService).mockReturnValue(makeGitService());
  });

  afterEach(() => {
    cleanupTrackedSessions();
    vi.useRealTimers();
  });

  it("replays a matching active session instead of starting a new review", async () => {
    const stream = makeMockStream();
    const existing = createSession("existing-session", process.cwd(), "abc123", "hash123", "unstaged");
    trackSession(existing.reviewId);
    markReady(existing.reviewId);
    addEvent(existing.reviewId, {
      type: "complete",
      result: { issues: [], summary: "Already done" },
      reviewId: existing.reviewId,
      durationMs: 100,
    });

    await streamReviewToSSE(mockAIClient, { mode: "unstaged" }, stream);

    expect(parsedEvents(stream)).toMatchObject([
      { type: "complete", reviewId: existing.reviewId },
    ]);
    expect(stream.events).toHaveLength(1);
  });

  it("streams a complete event and leaves the created session complete", async () => {
    const stream = makeMockStream();
    mockSuccessfulPipeline();

    await streamReviewToSSE(mockAIClient, { mode: "unstaged" }, stream);

    const completeEvent = parsedEvents(stream).find((event) => event.type === "complete");
    expect(completeEvent).toMatchObject({
      type: "complete",
      result: { issues: [], summary: "Clean" },
    });
    if (completeEvent?.type === "complete") {
      expect(getSession(completeEvent.reviewId)?.isComplete).toBe(true);
    }
  });

  it("cancels stale in-flight reviews for the same project and mode before streaming the new result", async () => {
    const stream = makeMockStream();
    const stale = createSession("stale-review", process.cwd(), "old-head", "old-hash", "unstaged");
    trackSession(stale.reviewId);
    markReady(stale.reviewId);
    mockSuccessfulPipeline();

    await streamReviewToSSE(mockAIClient, { mode: "unstaged" }, stream);

    expect(stale.isComplete).toBe(true);
    expect(stale.controller.signal.aborted).toBe(true);
    expect(stale.events).toMatchObject([
      { type: "error", error: { code: ReviewErrorCode.SESSION_STALE } },
    ]);
    expect(parsedEvents(stream).some((event) => event.type === "complete")).toBe(true);
  });
});

describe("review failure streaming", () => {
  const mockAIClient = {
    provider: "openrouter" as const,
    generate: vi.fn(),
    generateStream: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(createGitService).mockReturnValue(makeGitService());
  });

  afterEach(() => {
    cleanupTrackedSessions();
    vi.useRealTimers();
  });

  it("completes silently for AbortError", async () => {
    const stream = makeMockStream();
    vi.mocked(resolveGitDiff).mockRejectedValue(
      new DOMException("The operation was aborted", "AbortError"),
    );

    await streamReviewToSSE(mockAIClient, { mode: "unstaged" }, stream);

    expect(stream.events).toEqual([]);
  });

  it("streams step and terminal errors for review aborts", async () => {
    const stream = makeMockStream();
    vi.mocked(resolveGitDiff).mockRejectedValue({
      kind: "review_abort" as const,
      message: "No changes found",
      code: ReviewErrorCode.NO_DIFF,
      step: "diff" as const,
    });

    await streamReviewToSSE(mockAIClient, { mode: "unstaged" }, stream);

    expect(parsedEvents(stream)).toMatchObject([
      { type: "step_error", step: "diff", error: "No changes found" },
      { type: "error", error: { code: ReviewErrorCode.NO_DIFF, message: "No changes found" } },
    ]);
  });

  it("streams unexpected failures as generation errors", async () => {
    const stream = makeMockStream();
    vi.mocked(resolveGitDiff).mockRejectedValue(new Error("Unexpected boom"));

    await streamReviewToSSE(mockAIClient, { mode: "unstaged" }, stream);

    expect(parsedEvents(stream)).toMatchObject([
      {
        type: "error",
        error: { code: ReviewErrorCode.GENERATION_FAILED, message: "Unexpected boom" },
      },
    ]);
  });

  it("preserves known review error codes from thrown objects", async () => {
    const stream = makeMockStream();
    vi.mocked(resolveGitDiff).mockRejectedValue({
      code: ReviewErrorCode.AI_ERROR,
      message: "Upstream model failed",
    });

    await streamReviewToSSE(mockAIClient, { mode: "unstaged" }, stream);

    expect(parsedEvents(stream)).toMatchObject([
      { type: "error", error: { code: ReviewErrorCode.AI_ERROR, message: "Upstream model failed" } },
    ]);
  });

  it("rejects when the SSE stream closes before the buffered terminal error can be written", async () => {
    const stream = makeMockStream();
    stream.writeSSE = vi.fn().mockRejectedValue(new Error("stream closed"));
    vi.mocked(resolveGitDiff).mockRejectedValue(new Error("Unexpected boom"));

    await expect(streamReviewToSSE(mockAIClient, { mode: "unstaged" }, stream)).rejects.toThrow(
      "stream closed",
    );
  });
});
