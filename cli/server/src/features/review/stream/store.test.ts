import type { FullReviewStreamEvent, StepId } from "@diffgazer/core/schemas/events";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addEvent,
  buildScopeKey,
  cancelSession,
  cancelStaleSessionsForProjectMode,
  cleanupStaleSessions,
  createSession,
  deleteSession,
  getActiveSessionForProject,
  getSession,
  hasReadySessionForProjectMode,
  markCommitting,
  markComplete,
  markReady,
  onSessionComplete,
  shutdownSessions,
  subscribe,
} from "./store.js";

const createdSessionIds = new Set<string>();

function createTrackedSession(
  reviewId: string,
  options: {
    projectPath?: string;
    headCommit?: string;
    statusHash?: string;
    reviewConfigKey?: string;
    scopeKey?: string;
    mode?: "staged" | "unstaged";
    monotonicNow?: () => number;
  } = {},
) {
  createdSessionIds.add(reviewId);
  return createSession(reviewId, {
    projectPath: options.projectPath ?? "/project",
    headCommit: options.headCommit ?? "abc",
    statusHash: options.statusHash ?? "hash",
    statusHashKind: "full",
    mode: options.mode ?? "staged",
    ...(options.monotonicNow === undefined ? {} : { monotonicNow: options.monotonicNow }),
    ...(options.reviewConfigKey === undefined ? {} : { reviewConfigKey: options.reviewConfigKey }),
    ...(options.scopeKey === undefined ? {} : { scopeKey: options.scopeKey }),
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
    result: { issues: [] },
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

// Tear down the module-level stale-cleanup interval so it never outlives the suite.
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
    expect(
      getActiveSessionForProject("/project", {
        headCommit: "abc",
        statusHash: "hash",
        statusHashKind: "full",
        mode: "staged",
      }),
    ).toBeUndefined();

    expect(subscribe(session.reviewId, (event) => received.push(event))).toBeTypeOf("function");
    markReady(session.reviewId);
    expect(
      getActiveSessionForProject("/project", {
        headCommit: "abc",
        statusHash: "hash",
        statusHashKind: "full",
        mode: "staged",
      })?.reviewId,
    ).toBe(session.reviewId);

    const event = stepEvent();
    addEvent(session.reviewId, event);

    expect(received).toEqual([event]);
    expect(receivedEvents(session.reviewId)).toEqual([event]);

    markComplete(session.reviewId);
    addEvent(session.reviewId, stepEvent("review"));

    expect(received).toEqual([event]);
    expect(
      getActiveSessionForProject("/project", {
        headCommit: "abc",
        statusHash: "hash",
        statusHashKind: "full",
        mode: "staged",
      }),
    ).toBeUndefined();

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
    expect(receivedEvents(session.reviewId).filter((event) => event.type === "error")).toHaveLength(
      1,
    );
    expect(
      getActiveSessionForProject("/project", {
        headCommit: "abc",
        statusHash: "hash",
        statusHashKind: "full",
        mode: "unstaged",
      }),
    ).toBeUndefined();
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
    for (const session of [keptByState, keptByMode, stale]) {
      markReady(session.reviewId);
    }
    subscribe(stale.reviewId, (event) => staleEvents.push(event));

    cancelStaleSessionsForProjectMode("/project", "unstaged", "abc", "hash", "full");

    expect(staleEvents).toMatchObject([
      { type: "error", error: { code: ReviewErrorCode.SESSION_STALE } },
    ]);
    expect(
      getActiveSessionForProject("/project", {
        headCommit: "old-head",
        statusHash: "old-hash",
        statusHashKind: "full",
        mode: "unstaged",
      }),
    ).toBeUndefined();
    expect(
      getActiveSessionForProject("/project", {
        headCommit: "abc",
        statusHash: "hash",
        statusHashKind: "full",
        mode: "unstaged",
      })?.reviewId,
    ).toBe(keptByState.reviewId);
    expect(
      getActiveSessionForProject("/project", {
        headCommit: "abc",
        statusHash: "hash",
        statusHashKind: "full",
        mode: "staged",
      })?.reviewId,
    ).toBe(keptByMode.reviewId);
  });

  it("cancels a same-repo session with a different review config using the superseded message", () => {
    const received: FullReviewStreamEvent[] = [];
    const session = createTrackedSession("superseded-config", {
      mode: "unstaged",
      reviewConfigKey: "l:security",
    });
    markReady(session.reviewId);
    subscribe(session.reviewId, (event) => received.push(event));

    cancelStaleSessionsForProjectMode(
      "/project",
      "unstaged",
      "abc",
      "hash",
      "full",
      "l:correctness",
    );

    const terminal = received.find((event) => event.type === "error");

    expect(terminal).toBeDefined();
    if (terminal?.type === "error") {
      expect(terminal.error.message).toContain("superseded by a review");
      expect(terminal.error.message).not.toBe(
        "Review session cancelled because repository state changed.",
      );
    }
  });

  it("keeps active sessions when the current git identity is unavailable", () => {
    const session = createTrackedSession("unknown-git-state", { mode: "unstaged" });
    markReady(session.reviewId);

    cancelStaleSessionsForProjectMode("/project", "unstaged", "", "", "unavailable");

    expect(
      getActiveSessionForProject("/project", {
        headCommit: "abc",
        statusHash: "hash",
        statusHashKind: "full",
        mode: "unstaged",
      })?.reviewId,
    ).toBe(session.reviewId);
  });
});

describe("session bounds and subscriber failures", () => {
  it("emits an error event when evicting the oldest session", () => {
    const received: FullReviewStreamEvent[] = [];
    // Create the victim first so it has the oldest startedAt
    const victim = createTrackedSession("evict-oldest");
    subscribe(victim.reviewId, (event) => received.push(event));

    for (let i = 0; i < 49; i += 1) {
      vi.advanceTimersByTime(1);
      createTrackedSession(`evict-${i}`);
    }

    // The 51st session triggers eviction of the oldest (victim).
    vi.advanceTimersByTime(1);
    const trigger = createTrackedSession("evict-trigger");

    expect(received).toMatchObject([
      { type: "error", error: { code: ReviewErrorCode.SESSION_EVICTED } },
    ]);
    expect(getSession("evict-oldest")).toBeUndefined();
    expect(getSession(trigger.reviewId)).toBe(trigger);
  });

  it("skips the oldest committing session and evicts the oldest pending session", () => {
    const committingEvents: FullReviewStreamEvent[] = [];
    const pendingEvents: FullReviewStreamEvent[] = [];
    const committing = createTrackedSession("evict-committing");
    subscribe(committing.reviewId, (event) => committingEvents.push(event));
    expect(markCommitting(committing.reviewId)).toBe(true);

    vi.advanceTimersByTime(1);
    const pending = createTrackedSession("evict-pending");
    subscribe(pending.reviewId, (event) => pendingEvents.push(event));
    for (let index = 0; index < 48; index += 1) {
      vi.advanceTimersByTime(1);
      createTrackedSession(`evict-fill-${index}`);
    }

    createTrackedSession("evict-after-commit-start");

    expect(getSession(committing.reviewId)).toBe(committing);
    expect(committingEvents).toEqual([]);
    expect(getSession(pending.reviewId)).toBeUndefined();
    expect(pendingEvents).toMatchObject([
      { type: "error", error: { code: ReviewErrorCode.SESSION_EVICTED } },
    ]);
  });

  it("does not terminate an actively-emitting session older than the timeout window", () => {
    const received: FullReviewStreamEvent[] = [];
    const session = createTrackedSession("active-session");
    subscribe(session.reviewId, (event) => received.push(event));

    vi.advanceTimersByTime(30 * 60 * 1000 + 1);
    const event = stepEvent();
    addEvent(session.reviewId, event);
    vi.advanceTimersByTime(29 * 60 * 1000);
    cleanupStaleSessions();

    expect(received).toEqual([event]);
    expect(getSession("active-session")).toBeDefined();
  });

  it.each([
    {
      direction: "forward",
      eventWallTime: "2030-01-01T00:00:00.000Z",
      cleanupWallTime: "2040-01-01T00:00:00.000Z",
    },
    {
      direction: "backward",
      eventWallTime: "2020-01-01T00:00:00.000Z",
      cleanupWallTime: "2010-01-01T00:00:00.000Z",
    },
  ])("uses monotonic idle time after a $direction wall-clock jump", ({
    direction,
    eventWallTime,
    cleanupWallTime,
  }) => {
    let activityTick = 0;
    const received: FullReviewStreamEvent[] = [];
    vi.setSystemTime("2024-01-01T00:00:00.000Z");
    const session = createTrackedSession(`wall-clock-${direction}`, {
      monotonicNow: () => activityTick,
    });
    subscribe(session.reviewId, (event) => received.push(event));

    activityTick = 10 * 60 * 1000;
    vi.setSystemTime(eventWallTime);
    const event = stepEvent();
    addEvent(session.reviewId, event);

    expect(session.lastEventAt).toEqual(new Date(eventWallTime));

    activityTick += 30 * 60 * 1000;
    vi.setSystemTime(cleanupWallTime);
    cleanupStaleSessions();

    expect(received).toEqual([event]);
    expect(getSession(session.reviewId)).toBeDefined();

    activityTick += 1;
    cleanupStaleSessions();

    expect(received.at(-1)).toMatchObject({
      type: "error",
      error: { code: ReviewErrorCode.SESSION_TIMEOUT },
    });
    expect(getSession(session.reviewId)).toBeUndefined();
  });

  it.each([
    {
      id: "sync-throw",
      label: "throws synchronously",
      failingSubscriber: () => {
        throw new Error("sync fail");
      },
    },
    {
      id: "async-reject",
      label: "returns a rejected promise",
      failingSubscriber: async () => {
        throw new Error("async fail");
      },
    },
  ])("continues dispatching to a healthy subscriber when one subscriber $label", async ({
    id,
    failingSubscriber,
  }) => {
    const received: FullReviewStreamEvent[] = [];
    const session = createTrackedSession(`subscriber-isolation-${id}`);
    subscribe(session.reviewId, failingSubscriber);
    subscribe(session.reviewId, (event) => received.push(event));

    const event = stepEvent();
    expect(() => addEvent(session.reviewId, event)).not.toThrow();

    // Allow the rejected-promise case's microtask to settle before asserting.
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

    const liveNotices = received.filter((event) => event.type === "chunk");
    expect(liveNotices).toHaveLength(1);
    expect(received.at(-1)).toMatchObject({ type: "complete", reviewId: session.reviewId });

    const stored = receivedEvents(session.reviewId);
    expect(stored).toHaveLength(10_001);
    expect(stored.filter((event) => event.type === "chunk")).toHaveLength(1);
    expect(stored.filter((event) => event.type === "complete")).toHaveLength(1);
    expect(stored.at(-1)).toMatchObject({
      type: "complete",
      reviewId: session.reviewId,
    });
  });

  it("preserves the cap warning in the buffer after a terminal event overflows the cap", () => {
    const session = createTrackedSession("cap-then-terminal");

    // Fill to the cap, overflow with a non-terminal event (appends the warning as the
    // final slot), then emit the terminal complete event.
    for (let index = 0; index < 10_000; index += 1) {
      addEvent(session.reviewId, stepEvent("review"));
    }
    addEvent(session.reviewId, stepEvent("review")); // first drop -> appends notice
    addEvent(session.reviewId, completeEvent(session.reviewId));

    const stored = receivedEvents(session.reviewId);

    // A late SSE replay must see both the terminal result...
    const terminals = stored.filter((event) => event.type === "complete");
    expect(terminals).toHaveLength(1);
    expect(terminals[0]).toMatchObject({ type: "complete", reviewId: session.reviewId });

    // ...and the cap warning.
    const notices = stored.filter((event) => event.type === "chunk");
    expect(notices).toHaveLength(1);
    expect(notices[0]?.content).toContain("may be incomplete");
  });

  it("emits one client-facing cap notice when non-terminal events are dropped past the cap", () => {
    const received: FullReviewStreamEvent[] = [];
    const session = createTrackedSession("event-cap-notice");
    subscribe(session.reviewId, (event) => received.push(event));

    for (let index = 0; index < 10_003; index += 1) {
      addEvent(session.reviewId, stepEvent("review"));
    }

    const notices = received.filter(
      (event): event is Extract<FullReviewStreamEvent, { type: "chunk" }> => event.type === "chunk",
    );
    expect(notices).toHaveLength(1);
    expect(notices[0]?.content).toContain("may be incomplete");

    // Buffered exactly once so late SSE replays observe it too.
    const stored = receivedEvents(session.reviewId).filter((event) => event.type === "chunk");
    expect(stored).toHaveLength(1);
    // Cap still bounds growth: 10k real events + one notice overflow slot.
    expect(receivedEvents(session.reviewId)).toHaveLength(10_001);
  });
});

describe("onSessionComplete", () => {
  it("fires registered listeners when markComplete runs", () => {
    const session = createTrackedSession("on-complete-mark");
    let fired = false;
    onSessionComplete(session.reviewId, () => {
      fired = true;
    });

    markComplete(session.reviewId);

    expect(fired).toBe(true);
  });

  it("fires registered listeners when cancelSession runs", () => {
    const session = createTrackedSession("on-complete-cancel");
    let fired = false;
    onSessionComplete(session.reviewId, () => {
      fired = true;
    });

    cancelSession(session.reviewId);

    expect(fired).toBe(true);
  });

  it("invokes the listener immediately when the session is already complete", () => {
    const session = createTrackedSession("on-complete-already");
    markComplete(session.reviewId);

    let fired = false;
    onSessionComplete(session.reviewId, () => {
      fired = true;
    });

    expect(fired).toBe(true);
  });

  it("returns null when the session does not exist", () => {
    expect(onSessionComplete("missing", () => {})).toBeNull();
  });

  it("allows the consumer to unsubscribe before completion", () => {
    const session = createTrackedSession("on-complete-unsubscribe");
    let fired = false;
    const unsubscribe = onSessionComplete(session.reviewId, () => {
      fired = true;
    });
    unsubscribe?.();

    markComplete(session.reviewId);

    expect(fired).toBe(false);
  });

  it("isolates listener errors without preventing other listeners from running", () => {
    const session = createTrackedSession("on-complete-error-isolation");
    let secondRan = false;
    onSessionComplete(session.reviewId, () => {
      throw new Error("listener fail");
    });
    onSessionComplete(session.reviewId, () => {
      secondRan = true;
    });

    markComplete(session.reviewId);

    expect(secondRan).toBe(true);
  });
});

describe("deletion timer cleanup", () => {
  // Both retention timers must be unref'd so a pending session deletion never
  // keeps the Node process alive past its work (matches the module's unref'd
  // cleanup interval).
  it.each([
    {
      label: "markComplete",
      act: (id: string) => markComplete(id),
      expectedDelayMs: 5 * 60 * 1000,
    },
    {
      label: "cancelSession",
      act: (id: string) => cancelSession(id),
      expectedDelayMs: 2 * 60 * 1000,
    },
  ])("unrefs the $label deletion timer", ({ label, act, expectedDelayMs }) => {
    const session = createTrackedSession(`unref-${label}`);
    markReady(session.reviewId);

    const unref = vi.fn();
    const setTimeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockReturnValue({ unref } as unknown as ReturnType<typeof setTimeout>);

    act(session.reviewId);

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), expectedDelayMs);
    expect(unref).toHaveBeenCalledTimes(1);

    setTimeoutSpy.mockRestore();
  });
});

describe("shutdownSessions", () => {
  it("clears the stale-cleanup interval and is idempotent", () => {
    // Use real timers so clearInterval is the genuine global, not a fake-timer stub.
    vi.useRealTimers();
    const clearSpy = vi.spyOn(globalThis, "clearInterval");

    shutdownSessions();
    expect(clearSpy).toHaveBeenCalledTimes(1);

    shutdownSessions();
    expect(clearSpy).toHaveBeenCalledTimes(1);

    clearSpy.mockRestore();
  });

  it("aborts an active session, errors its subscriber, and clears it on shutdown", () => {
    const received: FullReviewStreamEvent[] = [];
    const session = createTrackedSession("shutdown-active", { mode: "unstaged" });
    markReady(session.reviewId);
    subscribe(session.reviewId, (event) => received.push(event));

    shutdownSessions();

    expect(session.controller.signal.aborted).toBe(true);
    expect(received).toMatchObject([
      { type: "error", error: { code: ReviewErrorCode.SERVER_SHUTDOWN } },
    ]);
    expect(getSession(session.reviewId)).toBeUndefined();
    expect(
      getActiveSessionForProject("/project", {
        headCommit: "abc",
        statusHash: "hash",
        statusHashKind: "full",
        mode: "unstaged",
      }),
    ).toBeUndefined();
  });
});

describe("active-session candidate precheck", () => {
  it("requires a ready non-complete session for the same project and mode", () => {
    expect(hasReadySessionForProjectMode("/project", "unstaged")).toBe(false);

    const candidate = createTrackedSession("candidate", { mode: "unstaged" });
    expect(hasReadySessionForProjectMode("/project", "unstaged")).toBe(false);

    markReady(candidate.reviewId);
    expect(hasReadySessionForProjectMode("/project", "unstaged")).toBe(true);

    markComplete(candidate.reviewId);
    const otherProject = createTrackedSession("candidate-other-project", {
      projectPath: "/other",
      mode: "unstaged",
    });
    const otherMode = createTrackedSession("candidate-other-mode", { mode: "staged" });
    markReady(otherProject.reviewId);
    markReady(otherMode.reviewId);

    expect(hasReadySessionForProjectMode("/project", "unstaged")).toBe(false);
  });

  it("ignores Git identity, scope, and review configuration", () => {
    const candidate = createSession("candidate-status-only", {
      projectPath: "/candidate",
      headCommit: "old-head",
      statusHash: "content-blind",
      statusHashKind: "status-only",
      mode: "unstaged",
      scopeKey: "f:src/app.ts",
      reviewConfigKey: "configured-review",
    });
    createdSessionIds.add(candidate.reviewId);
    markReady(candidate.reviewId);

    expect(hasReadySessionForProjectMode("/candidate", "unstaged")).toBe(true);
    expect(
      getActiveSessionForProject("/candidate", {
        headCommit: "current-head",
        statusHash: "current-hash",
        statusHashKind: "full",
        mode: "unstaged",
      }),
    ).toBeUndefined();
  });
});

describe("scoped active-session lookup", () => {
  it("returns the newest matching session for mode-only lookup and keeps scoped lookup exact", () => {
    const olderFull = createTrackedSession("older-full", { mode: "unstaged" });
    markReady(olderFull.reviewId);
    vi.advanceTimersByTime(1);
    const newerScoped = createTrackedSession("newer-scoped", {
      mode: "unstaged",
      scopeKey: "f:src/app.ts",
    });
    markReady(newerScoped.reviewId);

    const lookup = {
      headCommit: "abc",
      statusHash: "hash",
      statusHashKind: "full" as const,
      mode: "unstaged" as const,
    };

    expect(getActiveSessionForProject("/project", lookup)).toBe(newerScoped);
    expect(getActiveSessionForProject("/project", { ...lookup, scopeKey: "" })).toBe(olderFull);
    expect(getActiveSessionForProject("/project", { ...lookup, scopeKey: "f:src/app.ts" })).toBe(
      newerScoped,
    );
  });

  it("matches a scoped session by mode only (no scope key) so a reload can resume it", () => {
    const session = createSession("scoped", {
      projectPath: "/scoped",
      headCommit: "head",
      statusHash: "status",
      statusHashKind: "full",
      mode: "unstaged",
      scopeKey: "p:strict",
    });
    createdSessionIds.add("scoped");
    markReady("scoped");

    // A mode-only lookup must resolve the scoped session (the /sessions/active reload
    // path that must not miss a scoped review, F-163).
    expect(
      getActiveSessionForProject("/scoped", {
        headCommit: "head",
        statusHash: "status",
        statusHashKind: "full",
        mode: "unstaged",
      })?.reviewId,
    ).toBe(session.reviewId);

    // The same scope key still resolves it.
    expect(
      getActiveSessionForProject("/scoped", {
        headCommit: "head",
        statusHash: "status",
        statusHashKind: "full",
        mode: "unstaged",
        scopeKey: "p:strict",
      })?.reviewId,
    ).toBe(session.reviewId);

    // An explicit DIFFERENT scope key does not match (dedupe stays exact).
    expect(
      getActiveSessionForProject("/scoped", {
        headCommit: "head",
        statusHash: "status",
        statusHashKind: "full",
        mode: "unstaged",
        scopeKey: "p:other",
      }),
    ).toBeUndefined();
  });

  it("does not dedupe or match across status-hash kinds", () => {
    const session = createSession("kind-full", {
      projectPath: "/kinds",
      headCommit: "head",
      statusHash: "abc",
      statusHashKind: "full",
      mode: "unstaged",
    });
    createdSessionIds.add("kind-full");
    markReady("kind-full");

    // A status-only hash with the same value must NOT match a full-kind session.
    expect(
      getActiveSessionForProject("/kinds", {
        headCommit: "head",
        statusHash: "abc",
        statusHashKind: "status-only",
        mode: "unstaged",
      }),
    ).toBeUndefined();

    // An unavailable kind never dedupes.
    expect(
      getActiveSessionForProject("/kinds", {
        headCommit: "head",
        statusHash: "abc",
        statusHashKind: "unavailable",
        mode: "unstaged",
      }),
    ).toBeUndefined();

    expect(
      getActiveSessionForProject("/kinds", {
        headCommit: "head",
        statusHash: "abc",
        statusHashKind: "full",
        mode: "unstaged",
      })?.reviewId,
    ).toBe(session.reviewId);
  });
});

describe("buildScopeKey", () => {
  it("distinguishes file selections whose names contain the join delimiter", () => {
    // "a,b" as one file must not collide with the two files "a" and "b": a
    // naive comma-join collapses both to `f:a,b` and returns the wrong review.
    expect(buildScopeKey({ files: ["a,b"] })).not.toBe(buildScopeKey({ files: ["a", "b"] }));
    expect(buildScopeKey({ files: ["a|b"] })).not.toBe(buildScopeKey({ files: ["a", "b"] }));
    // The key is order-independent so the same selection always dedupes.
    expect(buildScopeKey({ files: ["b", "a"] })).toBe(buildScopeKey({ files: ["a", "b"] }));
  });
});

describe("content-blind status-only sessions are non-dedupable", () => {
  it("never serves a status-only file-scoped session, so edits get a fresh review", () => {
    const scopeKey = buildScopeKey({ files: ["src/app.ts"] });
    const session = createSession("status-only-file", {
      projectPath: "/blind",
      headCommit: "head",
      statusHash: "blind-hash",
      statusHashKind: "status-only",
      mode: "unstaged",
      scopeKey,
    });
    createdSessionIds.add("status-only-file");
    markReady(session.reviewId);

    // The status-only repo hash cannot prove the selected file's content is
    // unchanged, so an exact-identity dedupe lookup must NOT reuse this session.
    expect(
      getActiveSessionForProject("/blind", {
        headCommit: "head",
        statusHash: "blind-hash",
        statusHashKind: "status-only",
        mode: "unstaged",
        scopeKey,
      }),
    ).toBeUndefined();

    // A mode-only reload lookup must not resurface it either.
    expect(
      getActiveSessionForProject("/blind", {
        headCommit: "head",
        statusHash: "blind-hash",
        statusHashKind: "status-only",
        mode: "unstaged",
      }),
    ).toBeUndefined();
  });

  it("never serves a status-only repo-wide session, so unstaged edits get a fresh review", () => {
    const session = createSession("status-only-repo", {
      projectPath: "/blind-repo",
      headCommit: "head",
      statusHash: "blind-hash",
      statusHashKind: "status-only",
      mode: "unstaged",
    });
    createdSessionIds.add("status-only-repo");
    markReady(session.reviewId);

    // The repo hash degraded to status-only (a staged diff exceeded the read limit) but
    // stays constant across unstaged edits with the same status line, so reusing this
    // session would serve a stale review.
    expect(
      getActiveSessionForProject("/blind-repo", {
        headCommit: "head",
        statusHash: "blind-hash",
        statusHashKind: "status-only",
        mode: "unstaged",
      }),
    ).toBeUndefined();
  });
});
