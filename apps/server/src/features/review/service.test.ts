import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SSEWriter } from "../../shared/lib/http/types.js";
import type { FullReviewStreamEvent } from "@stargazer/schemas/events";
import type { ActiveSession } from "./sessions.js";
import type { EmitFn } from "./types.js";
import { ReviewErrorCode } from "@stargazer/schemas/review";
import { ErrorCode } from "@stargazer/schemas/errors";

// Mock sessions module (boundary: in-memory session store)
vi.mock("./sessions.js", () => ({
  createSession: vi.fn(),
  markReady: vi.fn(),
  addEvent: vi.fn(),
  markComplete: vi.fn(),
  subscribe: vi.fn(),
  getActiveSessionForProject: vi.fn(),
  getSession: vi.fn(),
  deleteSession: vi.fn(),
}));

// Mock pipeline module (boundary: orchestration layer)
vi.mock("./pipeline.js", () => ({
  resolveGitDiff: vi.fn(),
  resolveReviewConfig: vi.fn(),
  executeReview: vi.fn(),
  finalizeReview: vi.fn(),
}));

// Mock git service (boundary: git subprocess)
vi.mock("../../shared/lib/git/service.js", () => ({
  createGitService: vi.fn(() => ({
    getHeadCommit: vi.fn(async () => ({ ok: true, value: "abc123" })),
    getStatusHash: vi.fn(async () => "hash123"),
  })),
}));

// Mock utils
vi.mock("./utils.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("./utils.js")>();
  return {
    ...original,
    isReviewAbort: original.isReviewAbort,
  };
});

import {
  streamActiveSessionToSSE,
  streamReviewToSSE,
} from "./service.js";
import {
  markComplete,
  deleteSession,
  subscribe,
  getSession,
  getActiveSessionForProject,
  createSession,
  markReady,
} from "./sessions.js";
import {
  resolveGitDiff,
  resolveReviewConfig,
  executeReview,
  finalizeReview,
} from "./pipeline.js";
import { createGitService } from "../../shared/lib/git/service.js";

function makeMockStream(): SSEWriter & { events: Array<{ event: string; data: string }> } {
  const events: Array<{ event: string; data: string }> = [];
  return {
    events,
    writeSSE: vi.fn(async (payload: { event: string; data: string }) => {
      events.push(payload);
    }),
  };
}

function makeSession(overrides: Partial<ActiveSession> = {}): ActiveSession {
  return {
    reviewId: "review-1",
    projectPath: "/project",
    headCommit: "abc123",
    statusHash: "hash123",
    mode: "unstaged",
    startedAt: new Date(),
    events: [],
    isComplete: false,
    isReady: true,
    subscribers: new Set(),
    controller: new AbortController(),
    ...overrides,
  };
}

describe("streamActiveSessionToSSE", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should replay buffered events to the SSE stream", async () => {
    const stream = makeMockStream();
    const buffered: FullReviewStreamEvent[] = [
      { type: "step_start", step: "diff", timestamp: new Date().toISOString() },
      { type: "complete", result: {} as any, reviewId: "review-1", durationMs: 100 },
    ];
    const session = makeSession({ events: buffered, isComplete: true });

    await streamActiveSessionToSSE(stream, session);

    expect(stream.writeSSE).toHaveBeenCalledTimes(2);
    expect(stream.events[0]!.event).toBe("step_start");
    expect(stream.events[1]!.event).toBe("complete");
  });

  it("should subscribe for live events when session is not complete", async () => {
    const stream = makeMockStream();
    const session = makeSession({ events: [], isComplete: false });

    vi.mocked(subscribe).mockImplementation((_id, callback) => {
      // Simulate a live event arriving then completion
      setTimeout(() => {
        callback({ type: "complete", result: {} as any, reviewId: "review-1", durationMs: 50 });
      }, 5);
      return () => {};
    });
    vi.mocked(getSession).mockReturnValue(session);

    await streamActiveSessionToSSE(stream, session);

    expect(subscribe).toHaveBeenCalledWith("review-1", expect.any(Function));
    expect(stream.events.some((e) => e.event === "complete")).toBe(true);
  });

  it("should write stale error when subscribe returns null", async () => {
    const stream = makeMockStream();
    const session = makeSession({ events: [], isComplete: false });

    vi.mocked(subscribe).mockReturnValue(null);

    await streamActiveSessionToSSE(stream, session);

    expect(stream.events).toHaveLength(1);
    const parsed = JSON.parse(stream.events[0]!.data);
    expect(parsed.type).toBe("error");
    expect(parsed.error.code).toBe(ReviewErrorCode.SESSION_STALE);
  });

  it("should write stale error when session completes during replay", async () => {
    const stream = makeMockStream();
    const completedSession = makeSession({ isComplete: true });

    vi.mocked(subscribe).mockImplementation((_id, _cb) => {
      return () => {};
    });
    // Return the completed session when checked after subscribe
    vi.mocked(getSession).mockReturnValue(completedSession);

    await streamActiveSessionToSSE(stream, makeSession({ events: [], isComplete: false }));

    expect(stream.events).toHaveLength(1);
    const parsed = JSON.parse(stream.events[0]!.data);
    expect(parsed.error.code).toBe(ReviewErrorCode.SESSION_STALE);
  });
});

describe("streamReviewToSSE", () => {
  const mockAIClient = {
    provider: "openrouter" as const,
    generate: vi.fn(),
    generateStream: vi.fn(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.mocked(createGitService).mockReturnValue({
      getHeadCommit: vi.fn(async () => ({ ok: true, value: "abc123" })),
      getStatusHash: vi.fn(async () => "hash123"),
    } as any);
  });

  it("should replay existing session when found", async () => {
    const stream = makeMockStream();
    const existingSession = makeSession({
      events: [
        { type: "complete", result: {} as any, reviewId: "review-1", durationMs: 100 },
      ],
      isComplete: true,
    });

    vi.mocked(getActiveSessionForProject).mockReturnValue(existingSession);

    await streamReviewToSSE(mockAIClient, { mode: "unstaged" }, stream);

    expect(getActiveSessionForProject).toHaveBeenCalledWith(
      expect.any(String),
      "abc123",
      "hash123",
      "unstaged",
    );
    // Should have replayed the complete event
    expect(stream.events[0]!.event).toBe("complete");
    // Should NOT have created a new session
    expect(createSession).not.toHaveBeenCalled();
  });

  it("should create new session when no existing session found", async () => {
    const stream = makeMockStream();
    const session = makeSession();

    vi.mocked(getActiveSessionForProject).mockReturnValue(undefined);
    vi.mocked(createSession).mockReturnValue(session);

    const parsedDiff = { files: [], totalStats: { filesChanged: 0, additions: 0, deletions: 0, totalSizeBytes: 0 } };
    vi.mocked(resolveGitDiff).mockResolvedValue(parsedDiff);
    vi.mocked(resolveReviewConfig).mockResolvedValue({
      activeLenses: ["correctness"],
      profile: undefined,
      projectContext: "",
    });
    vi.mocked(executeReview).mockResolvedValue({ issues: [], summary: "Clean" });
    vi.mocked(finalizeReview).mockResolvedValue({
      issues: [],
      executiveSummary: "Clean",
      report: "",
      reviewId: "review-1",
      durationMs: 100,
      projectPath: "/project",
      mode: "unstaged",
      headCommit: "abc123",
      statusHash: "hash123",
      diff: parsedDiff,
    } as any);

    await streamReviewToSSE(mockAIClient, { mode: "unstaged" }, stream);

    expect(createSession).toHaveBeenCalled();
    expect(markReady).toHaveBeenCalled();
    expect(markComplete).toHaveBeenCalled();
    // Should have emitted complete event
    expect(stream.events.some((e) => e.event === "complete")).toBe(true);
  });
});

describe("handleReviewFailure (via streamReviewToSSE)", () => {
  const mockAIClient = {
    provider: "openrouter" as const,
    generate: vi.fn(),
    generateStream: vi.fn(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.mocked(createGitService).mockReturnValue({
      getHeadCommit: vi.fn(async () => ({ ok: true, value: "abc123" })),
      getStatusHash: vi.fn(async () => "hash123"),
    } as any);

    vi.mocked(getActiveSessionForProject).mockReturnValue(undefined);
    vi.mocked(createSession).mockReturnValue(makeSession());
  });

  it("should handle AbortError silently", async () => {
    const stream = makeMockStream();

    vi.mocked(resolveGitDiff).mockRejectedValue(
      new DOMException("The operation was aborted", "AbortError"),
    );

    await streamReviewToSSE(mockAIClient, { mode: "unstaged" }, stream);

    expect(markComplete).toHaveBeenCalled();
    expect(deleteSession).toHaveBeenCalled();
    // No error written to stream
    expect(stream.events).toHaveLength(0);
  });

  it("should handle ReviewAbort with step error", async () => {
    const stream = makeMockStream();

    const reviewAbort = {
      kind: "review_abort" as const,
      message: "No changes found",
      code: "NO_CHANGES",
      step: "diff" as const,
    };
    vi.mocked(resolveGitDiff).mockRejectedValue(reviewAbort);

    await streamReviewToSSE(mockAIClient, { mode: "unstaged" }, stream);

    // Should have written an error to stream
    const errorEvents = stream.events.filter((e) => e.event === "error");
    expect(errorEvents).toHaveLength(1);
  });

  it("should handle ReviewAbort without step", async () => {
    const stream = makeMockStream();

    const reviewAbort = {
      kind: "review_abort" as const,
      message: "Config invalid",
      code: "CONFIG_ERROR",
    };
    vi.mocked(resolveGitDiff).mockRejectedValue(reviewAbort);

    await streamReviewToSSE(mockAIClient, { mode: "unstaged" }, stream);

    const errorEvents = stream.events.filter((e) => e.event === "error");
    expect(errorEvents).toHaveLength(1);
    expect(markComplete).toHaveBeenCalled();
  });

  it("should handle unexpected errors and write SSE error", async () => {
    const stream = makeMockStream();

    vi.mocked(resolveGitDiff).mockRejectedValue(new Error("Unexpected boom"));

    await streamReviewToSSE(mockAIClient, { mode: "unstaged" }, stream);

    expect(markComplete).toHaveBeenCalled();
    expect(deleteSession).toHaveBeenCalled();
    const errorEvents = stream.events.filter((e) => e.event === "error");
    expect(errorEvents).toHaveLength(1);
    const parsed = JSON.parse(errorEvents[0]!.data);
    expect(parsed.error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(parsed.error.message).toBe("Unexpected boom");
  });

  it("should re-throw unexpected error when SSE write fails", async () => {
    const stream = makeMockStream();
    stream.writeSSE = vi.fn().mockRejectedValue(new Error("stream closed"));

    vi.mocked(resolveGitDiff).mockRejectedValue(new Error("Unexpected boom"));

    await expect(
      streamReviewToSSE(mockAIClient, { mode: "unstaged" }, stream),
    ).rejects.toThrow("Unexpected boom");
  });
});

