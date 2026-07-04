import type { FullReviewStreamEvent, StepId } from "@diffgazer/core/schemas/events";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addEvent,
  cancelSession,
  cancelStaleSessionsForProjectMode,
  cleanupStaleSessions,
  createSession,
  deleteSession,
  getActiveSessionForProject,
  getSession,
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
    mode?: "staged" | "unstaged";
  } = {},
) {
  createdSessionIds.add(reviewId);
  return createSession(reviewId, {
    projectPath: options.projectPath ?? "/project",
    headCommit: options.headCommit ?? "abc",
    statusHash: options.statusHash ?? "hash",
    statusHashKind: "full",
    mode: options.mode ?? "staged",
    ...(options.reviewConfigKey === undefined ? {} : { reviewConfigKey: options.reviewConfigKey }),
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
// suite. Idempotent, so it is safe even if a test already called it.
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
      { type: "error", error: { code: ReviewErrorCode.SESSION_EVICTED } },
    ]);
    expect(getSession("evict-oldest")).toBeUndefined();
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

  it("terminates a session idle past the timeout window with SESSION_TIMEOUT", () => {
    const received: FullReviewStreamEvent[] = [];
    const session = createTrackedSession("timeout-session");
    subscribe(session.reviewId, (event) => received.push(event));

    // Advance the clock past the 30-minute SESSION_TIMEOUT_MS, then run the
    // stale-session sweep the cleanup interval drives in production.
    vi.advanceTimersByTime(30 * 60 * 1000 + 1);
    cleanupStaleSessions();

    expect(received).toMatchObject([
      { type: "error", error: { code: ReviewErrorCode.SESSION_TIMEOUT } },
    ]);
    expect(getSession("timeout-session")).toBeUndefined();
  });

  it("continues dispatching when an async subscriber rejects", async () => {
    // The contract under test is the public observable behavior (the second
    // subscriber still receives the event), not the dispatch error the impl logs.
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

  it("preserves the cap warning in the buffer after a terminal event overflows the cap", () => {
    // The contract under test is that the buffered cap notice survives terminal
    // replacement so a late SSE subscriber replaying session.events sees both.
    const session = createTrackedSession("cap-then-terminal");

    // Fill to the cap, then overflow with a non-terminal event so the warning
    // is appended as the final slot, then emit the terminal complete event.
    for (let index = 0; index < 10_000; index += 1) {
      addEvent(session.reviewId, stepEvent("review"));
    }
    addEvent(session.reviewId, stepEvent("review")); // first drop -> appends notice
    addEvent(session.reviewId, completeEvent(session.reviewId));

    const stored = receivedEvents(session.reviewId);

    // Late SSE subscriber replays the buffer and must see the terminal result...
    const terminals = stored.filter((event) => event.type === "complete");
    expect(terminals).toHaveLength(1);
    expect(terminals[0]).toMatchObject({ type: "complete", reviewId: session.reviewId });

    // ...AND the cap warning that progress events were truncated.
    const notices = stored.filter((event) => event.type === "chunk");
    expect(notices).toHaveLength(1);
    expect(notices[0]?.content).toContain("may be incomplete");
  });

  it("emits one client-facing cap notice when non-terminal events are dropped past the cap", () => {
    // The contract under test is the client-facing notice, not the log line.
    const received: FullReviewStreamEvent[] = [];
    const session = createTrackedSession("event-cap-notice");
    subscribe(session.reviewId, (event) => received.push(event));

    // Fill to the cap, then push three more non-terminal events that overflow.
    for (let index = 0; index < 10_003; index += 1) {
      addEvent(session.reviewId, stepEvent("review"));
    }

    const notices = received.filter(
      (event): event is Extract<FullReviewStreamEvent, { type: "chunk" }> => event.type === "chunk",
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
    // The observable contract is that the second listener still runs after the
    // first one throws.
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

    // A second call must be a no-op (the interval handle was already released).
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

    // The in-flight review work is aborted...
    expect(session.controller.signal.aborted).toBe(true);
    // ...the subscriber sees a terminal server-shutdown error...
    expect(received).toMatchObject([
      { type: "error", error: { code: ReviewErrorCode.SERVER_SHUTDOWN } },
    ]);
    // ...and the session is removed so no SSE client keeps the process alive.
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

describe("scoped active-session lookup", () => {
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

    // A mode-only lookup (no scope key) resolves the scoped session — this is the
    // /sessions/active reload path that must not miss a scoped review (F-163).
    expect(
      getActiveSessionForProject("/scoped", {
        headCommit: "head",
        statusHash: "status",
        statusHashKind: "full",
        mode: "unstaged",
      })?.reviewId,
    ).toBe(session.reviewId);

    // The same scope key still resolves the session.
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

    // The same full-kind hash resolves it.
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
