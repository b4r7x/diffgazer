import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import type { FullReviewStreamEvent, StepId } from "@diffgazer/core/schemas/events";
import type { SSEWriter } from "../../shared/lib/http/sse.js";
import {
  addEvent,
  createSession,
  deleteSession,
  markComplete,
  markReady,
} from "./sessions.js";
import { streamActiveSessionToSSE } from "./sse-replay.js";

const trackedIds = new Set<string>();

function createTrackedSession(reviewId: string) {
  trackedIds.add(reviewId);
  const session = createSession(reviewId, { projectPath: "/project", headCommit: "abc", statusHash: "hash", mode: "staged" });
  markReady(reviewId);
  return session;
}

function stepEvent(step: StepId = "diff"): FullReviewStreamEvent {
  return {
    type: "step_start",
    step,
    timestamp: "2024-01-01T00:00:00Z",
  };
}

function completeEvent(reviewId: string): FullReviewStreamEvent {
  return {
    type: "complete",
    result: { issues: [], summary: "Clean" },
    reviewId,
    durationMs: 100,
  };
}

interface RecordingWriter {
  stream: SSEWriter;
  writes: { event: string; data: string }[];
}

function recordingWriter(): RecordingWriter {
  const writes: { event: string; data: string }[] = [];
  return {
    stream: {
      writeSSE: async (payload) => {
        writes.push(payload);
      },
    },
    writes,
  };
}

function failingTerminalWriter(failOn: readonly string[]): {
  stream: SSEWriter;
  failure: Error;
} {
  const failure = new Error("terminal write failed");
  return {
    failure,
    stream: {
      writeSSE: async (payload) => {
        if (failOn.includes(payload.event)) {
          throw failure;
        }
      },
    },
  };
}

afterEach(() => {
  for (const id of trackedIds) {
    deleteSession(id);
  }
  trackedIds.clear();
  vi.restoreAllMocks();
});

describe("streamActiveSessionToSSE — terminal write failures", () => {
  it("logs and rejects when the terminal write rejects (stale session path)", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const session = createTrackedSession("stale-terminal-fail");
    // Force `subscribe` to return null so the STALE_ERROR_EVENT terminal write
    // is exercised. Removing the session from the active map (without
    // mutating `session.events`) keeps the caller's reference live while the
    // lookups inside `subscribe`/`onSessionComplete` return null.
    deleteSession(session.reviewId);
    const { stream, failure } = failingTerminalWriter(["error"]);

    await expect(streamActiveSessionToSSE(stream, session)).rejects.toBe(failure);

    expect(consoleWarn).toHaveBeenCalledWith(
      "SSE terminal write failed:",
      failure,
    );
  });

  it("logs and rejects when the subscriber write rejects mid-stream", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const session = createTrackedSession("subscriber-write-fail");
    const failure = new Error("mid-stream write failed");
    const stream: SSEWriter = {
      writeSSE: async (payload) => {
        if (payload.event === "step_start") {
          throw failure;
        }
      },
    };

    const streamPromise = streamActiveSessionToSSE(stream, session);
    // Defer the failing event until subscription is wired.
    await Promise.resolve();
    addEvent(session.reviewId, stepEvent());

    await expect(streamPromise).rejects.toBe(failure);
    expect(consoleWarn).toHaveBeenCalledWith(
      "SSE subscriber write failed:",
      failure,
    );
  });

  it("resolves quietly when the client has already aborted before a write failure surfaces", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const session = createTrackedSession("aborted-quiet");
    deleteSession(session.reviewId);
    const controller = new AbortController();
    const { stream } = failingTerminalWriter(["error"]);
    // Wrap the stream so we can abort after the terminal write is queued but
    // before its rejection is observed.
    const wrapped: SSEWriter = {
      writeSSE: async (payload) => {
        controller.abort();
        await stream.writeSSE(payload);
      },
    };

    await expect(
      streamActiveSessionToSSE(wrapped, session, controller.signal),
    ).resolves.toBeUndefined();
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it("does not leave the replay stuck after a terminal write failure", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const session = createTrackedSession("not-stuck");
    deleteSession(session.reviewId);
    const { stream, failure } = failingTerminalWriter(["error"]);

    // A bug would be that the promise never settles. `vi.waitFor` polls a
    // bounded predicate (with its own internal timeout) instead of racing a
    // fixed `setTimeout`, so the assertion still fails for a stuck replay
    // without depending on real wall-clock timing.
    let outcome: "pending" | "resolved" | "rejected" | "other" = "pending";
    streamActiveSessionToSSE(stream, session).then(
      () => { outcome = "resolved"; },
      (e) => { outcome = e === failure ? "rejected" : "other"; },
    );

    await vi.waitFor(() => {
      if (outcome === "pending") throw new Error("replay still pending");
    });

    expect(outcome).toBe("rejected");
  });

  it("replays terminal events without invoking the terminal-write path", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const session = createTrackedSession("happy-replay");
    addEvent(session.reviewId, stepEvent());
    addEvent(session.reviewId, completeEvent(session.reviewId));
    markComplete(session.reviewId);
    const { stream, writes } = recordingWriter();

    await streamActiveSessionToSSE(stream, session);

    expect(writes.map((w) => w.event)).toEqual(["step_start", "complete"]);
    expect(consoleWarn).not.toHaveBeenCalled();
    // Sanity: SESSION_STALE error never appears in the happy path.
    expect(
      writes.some((w) => w.data.includes(ReviewErrorCode.SESSION_STALE)),
    ).toBe(false);
  });
});
