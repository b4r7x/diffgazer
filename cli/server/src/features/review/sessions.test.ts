import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
  return createSession(
    reviewId,
    options.projectPath ?? "/project",
    options.headCommit ?? "abc",
    options.statusHash ?? "hash",
    options.mode ?? "staged",
  );
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
    expect(getActiveSessionForProject("/project", "abc", "hash", "staged")).toBeUndefined();

    expect(subscribe(session.reviewId, (event) => received.push(event))).toBeTypeOf("function");
    markReady(session.reviewId);
    expect(getActiveSessionForProject("/project", "abc", "hash", "staged")?.reviewId).toBe(
      session.reviewId,
    );

    const event = stepEvent();
    addEvent(session.reviewId, event);

    expect(received).toEqual([event]);
    expect(receivedEvents(session.reviewId)).toEqual([event]);

    markComplete(session.reviewId);
    addEvent(session.reviewId, stepEvent("review"));

    expect(received).toEqual([event]);
    expect(getActiveSessionForProject("/project", "abc", "hash", "staged")).toBeUndefined();

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
    expect(getActiveSessionForProject("/project", "abc", "hash", "unstaged")).toBeUndefined();
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
    expect(getActiveSessionForProject("/project", "old-head", "old-hash", "unstaged")).toBeUndefined();
    expect(getActiveSessionForProject("/project", "abc", "hash", "unstaged")?.reviewId).toBe(
      keptByState.reviewId,
    );
    expect(getActiveSessionForProject("/project", "abc", "hash", "staged")?.reviewId).toBe(
      keptByMode.reviewId,
    );
  });

  it("keeps active sessions when the current git identity is unavailable", () => {
    const session = createTrackedSession("unknown-git-state", { mode: "unstaged" });
    markReady(session.reviewId);

    cancelStaleSessionsForProjectMode("/project", "unstaged", "", "");

    expect(getActiveSessionForProject("/project", "abc", "hash", "unstaged")?.reviewId).toBe(
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
