import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import type { FullReviewStreamEvent, StepId } from "@diffgazer/core/schemas/events";
import {
  addEvent,
  cancelSession,
  cancelStaleSessionsForProjectMode,
  createSession,
  deleteSession,
  getActiveSessionForProject,
  getSession,
  markComplete,
  markReady,
  onSessionComplete,
  shutdownSessions,
  subscribe,
} from "./sessions.js";

const createdSessionIds = new Set<string>();

function createTrackedSession(
  reviewId: string,
  options: {
    projectPath?: string;
    headCommit?: string;
    statusHash?: string;
    mode?: "staged" | "unstaged";
  } = {},
) {
  createdSessionIds.add(reviewId);
  return createSession(reviewId, {
    projectPath: options.projectPath ?? "/project",
    headCommit: options.headCommit ?? "abc",
    statusHash: options.statusHash ?? "hash",
    mode: options.mode ?? "staged",
  });
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

function receivedEvents(reviewId: string): FullReviewStreamEvent[] {
  return getSession(reviewId)?.events ?? [];
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  for (const id of createdSessionIds) {
    deleteSession(id);
  }
  createdSessionIds.clear();
  vi.useRealTimers();
});

// Tear down the module-level stale-cleanup interval so it never outlives the
// suite (F151). Idempotent, so it is safe even if a test already called it.
afterAll(() => {
  shutdownSessions();
});

describe("review session lifecycle", () => {
  it("records events, notifies subscribers, becomes active when ready, and expires after completion", () => {
    const received: FullReviewStreamEvent[] = [];
    const session = createTrackedSession("lifecycle");

    expect(getSession(session.reviewId)).toMatchObject({
      reviewId: "lifecycle",
      projectPath: "/project",
      headCommit: "abc",
      statusHash: "hash",
      mode: "staged",
      isReady: false,
      isComplete: false,
    });
    expect(getActiveSessionForProject("/project", { headCommit: "abc", statusHash: "hash", mode: "staged" })).toBeUndefined();

    expect(subscribe(session.reviewId, (event) => received.push(event))).toBeTypeOf("function");
    markReady(session.reviewId);
    expect(getActiveSessionForProject("/project", { headCommit: "abc", statusHash: "hash", mode: "staged" })?.reviewId).toBe(
      session.reviewId,
    );

    const event = stepEvent();
    addEvent(session.reviewId, event);

    expect(received).toEqual([event]);
    expect(receivedEvents(session.reviewId)).toEqual([event]);

    markComplete(session.reviewId);
    addEvent(session.reviewId, stepEvent("review"));

    expect(received).toEqual([event]);
    expect(getActiveSessionForProject("/project", { headCommit: "abc", statusHash: "hash", mode: "staged" })).toBeUndefined();

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(getSession(session.reviewId)).toBeUndefined();
  });

  it("allows subscribers to unsubscribe before later events", () => {
    const received: FullReviewStreamEvent[] = [];
    const session = createTrackedSession("unsubscribe");
    const unsubscribe = subscribe(session.reviewId, (event) => received.push(event));

    unsubscribe?.();
    addEvent(session.reviewId, stepEvent());

    expect(received).toEqual([]);
    expect(receivedEvents(session.reviewId)).toEqual([stepEvent()]);
  });

  it("ignores unknown sessions without throwing", () => {
    expect(getSession("missing")).toBeUndefined();
    expect(subscribe("missing", () => {})).toBeNull();
    expect(() => markReady("missing")).not.toThrow();
    expect(() => addEvent("missing", stepEvent())).not.toThrow();
    expect(() => markComplete("missing")).not.toThrow();
    expect(() => cancelSession("missing")).not.toThrow();
  });
});

describe("session cancellation", () => {
  it("emits one stale-session error and removes the session from active lookups", () => {
    const received: FullReviewStreamEvent[] = [];
    const session = createTrackedSession("cancelled", { mode: "unstaged" });
    markReady(session.reviewId);
    subscribe(session.reviewId, (event) => received.push(event));

    cancelSession(session.reviewId);
    cancelSession(session.reviewId);
    addEvent(session.reviewId, stepEvent());

    expect(received).toMatchObject([
      { type: "error", error: { code: ReviewErrorCode.SESSION_STALE } },
    ]);
    expect(receivedEvents(session.reviewId).filter((event) => event.type === "error")).toHaveLength(1);
    expect(getActiveSessionForProject("/project", { headCommit: "abc", statusHash: "hash", mode: "unstaged" })).toBeUndefined();
  });

  it("cancels only ready sessions for the same project and mode when git state changes", () => {
    const staleEvents: FullReviewStreamEvent[] = [];
    const keptByState = createTrackedSession("same-state", { mode: "unstaged" });
    const keptByMode = createTrackedSession("other-mode", { mode: "staged" });
    const stale = createTrackedSession("stale-state", {
      headCommit: "old-head",
      statusHash: "old-hash",
      mode: "unstaged",
    });
    [keptByState, keptByMode, stale].forEach((session) => markReady(session.reviewId));
    subscribe(stale.reviewId, (event) => staleEvents.push(event));

    cancelStaleSessionsForProjectMode("/project", "unstaged", "abc", "hash");

    expect(staleEvents).toMatchObject([
      { type: "error", error: { code: ReviewErrorCode.SESSION_STALE } },
    ]);
    expect(getActiveSessionForProject("/project", { headCommit: "old-head", statusHash: "old-hash", mode: "unstaged" })).toBeUndefined();
    expect(getActiveSessionForProject("/project", { headCommit: "abc", statusHash: "hash", mode: "unstaged" })?.reviewId).toBe(
      keptByState.reviewId,
    );
    expect(getActiveSessionForProject("/project", { headCommit: "abc", statusHash: "hash", mode: "staged" })?.reviewId).toBe(
      keptByMode.reviewId,
    );
  });

  it("keeps active sessions when the current git identity is unavailable", () => {
    const session = createTrackedSession("unknown-git-state", { mode: "unstaged" });
    markReady(session.reviewId);

    cancelStaleSessionsForProjectMode("/project", "unstaged", "", "");

    expect(getActiveSessionForProject("/project", { headCommit: "abc", statusHash: "hash", mode: "unstaged" })?.reviewId).toBe(
      session.reviewId,
    );
  });
});

describe("session bounds and subscriber failures", () => {
  it("evicts the oldest session when the session limit is reached", () => {
    for (let i = 0; i < 50; i += 1) {
      vi.advanceTimersByTime(1);
      createTrackedSession(`bulk-${i}`);
    }

    createTrackedSession("bulk-50");

    expect(getSession("bulk-0")).toBeUndefined();
    expect(getSession("bulk-50")).toBeDefined();
  });

  it("emits an error event when evicting the oldest session", () => {
    const received: FullReviewStreamEvent[] = [];
    // Create the victim first so it has the oldest startedAt
    const victim = createTrackedSession("evict-oldest");
    subscribe(victim.reviewId, (event) => received.push(event));

    for (let i = 0; i < 49; i += 1) {
      vi.advanceTimersByTime(1);
      createTrackedSession(`evict-${i}`);
    }

    // This 51st session triggers eviction of the oldest (victim)
    vi.advanceTimersByTime(1);
    createTrackedSession("evict-trigger");

    expect(received).toMatchObject([
      { type: "error", error: { code: ReviewErrorCode.SESSION_STALE } },
    ]);
    expect(getSession("evict-oldest")).toBeUndefined();
  });

  it("continues dispatching when an async subscriber rejects", async () => {
    // Suppress the expected console.error noise; we assert on the public
    // observable contract (the second subscriber still receives the event),
    // not on the specific error string the impl chose to log.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const received: FullReviewStreamEvent[] = [];
    const session = createTrackedSession("subscriber-rejects");
    subscribe(session.reviewId, async () => {
      throw new Error("async fail");
    });
    subscribe(session.reviewId, (event) => received.push(event));

    const event = stepEvent();
    addEvent(session.reviewId, event);

    await Promise.resolve();

    expect(received).toEqual([event]);
  });

  it("keeps terminal events observable when the event buffer is full", () => {
    const received: FullReviewStreamEvent[] = [];
    const session = createTrackedSession("event-cap");
    subscribe(session.reviewId, (event) => received.push(event));

    for (let index = 0; index < 10_000; index += 1) {
      addEvent(session.reviewId, stepEvent("review"));
    }
    addEvent(session.reviewId, completeEvent(session.reviewId));

    expect(received.at(-1)).toMatchObject({ type: "complete", reviewId: session.reviewId });
    expect(receivedEvents(session.reviewId)).toHaveLength(10_000);
    expect(receivedEvents(session.reviewId).at(-1)).toMatchObject({
      type: "complete",
      reviewId: session.reviewId,
    });
  });

  it("emits one client-facing cap notice when non-terminal events are dropped past the cap", () => {
    // Suppress the expected server-side cap console.warn; the contract under
    // test is the client-facing notice, not the log line. (F155)
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const received: FullReviewStreamEvent[] = [];
    const session = createTrackedSession("event-cap-notice");
    subscribe(session.reviewId, (event) => received.push(event));

    // Fill to the cap, then push three more non-terminal events that overflow.
    for (let index = 0; index < 10_003; index += 1) {
      addEvent(session.reviewId, stepEvent("review"));
    }

    const notices = received.filter(
      (event): event is Extract<FullReviewStreamEvent, { type: "chunk" }> =>
        event.type === "chunk",
    );
    expect(notices).toHaveLength(1);
    expect(notices[0]?.content).toContain("may be incomplete");

    // The notice is buffered exactly once so late SSE replays observe it too.
    const stored = receivedEvents(session.reviewId).filter((event) => event.type === "chunk");
    expect(stored).toHaveLength(1);
    // The cap still bounds growth: real events (10k) + one notice overflow slot.
    expect(receivedEvents(session.reviewId)).toHaveLength(10_001);
  });
});

describe("onSessionComplete", () => {
  it("fires registered listeners when markComplete runs", () => {
    const session = createTrackedSession("on-complete-mark");
    let fired = false;
    onSessionComplete(session.reviewId, () => { fired = true; });

    markComplete(session.reviewId);

    expect(fired).toBe(true);
  });

  it("fires registered listeners when cancelSession runs", () => {
    const session = createTrackedSession("on-complete-cancel");
    let fired = false;
    onSessionComplete(session.reviewId, () => { fired = true; });

    cancelSession(session.reviewId);

    expect(fired).toBe(true);
  });

  it("invokes the listener immediately when the session is already complete", () => {
    const session = createTrackedSession("on-complete-already");
    markComplete(session.reviewId);

    let fired = false;
    onSessionComplete(session.reviewId, () => { fired = true; });

    expect(fired).toBe(true);
  });

  it("returns null when the session does not exist", () => {
    expect(onSessionComplete("missing", () => {})).toBeNull();
  });

  it("allows the consumer to unsubscribe before completion", () => {
    const session = createTrackedSession("on-complete-unsubscribe");
    let fired = false;
    const unsubscribe = onSessionComplete(session.reviewId, () => { fired = true; });
    unsubscribe?.();

    markComplete(session.reviewId);

    expect(fired).toBe(false);
  });

  it("isolates listener errors without preventing other listeners from running", () => {
    // Suppress the expected console.error noise; the observable contract is
    // that the second listener still runs after the first one throws.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const session = createTrackedSession("on-complete-error-isolation");
    let secondRan = false;
    onSessionComplete(session.reviewId, () => {
      throw new Error("listener fail");
    });
    onSessionComplete(session.reviewId, () => { secondRan = true; });

    markComplete(session.reviewId);

    expect(secondRan).toBe(true);
  });
});

describe("shutdownSessions", () => {
  it("clears the stale-cleanup interval and is idempotent", () => {
    // Use real timers so clearInterval is the genuine global, not a fake-timer stub.
    vi.useRealTimers();
    const clearSpy = vi.spyOn(globalThis, "clearInterval");

    shutdownSessions();
    expect(clearSpy).toHaveBeenCalledTimes(1);

    // A second call must be a no-op (the interval handle was already released).
    shutdownSessions();
    expect(clearSpy).toHaveBeenCalledTimes(1);

    clearSpy.mockRestore();
  });
});
