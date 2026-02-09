import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createSession,
  getSession,
  deleteSession,
  markReady,
  markComplete,
  addEvent,
  subscribe,
  cancelSession,
  cancelStaleSessionsForProjectMode,
  getActiveSessionForProject,
} from "./sessions.js";
import type { FullReviewStreamEvent } from "@diffgazer/schemas/events";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  // Clean up any sessions created during tests
  const ids = ["test-1", "test-2", "test-3", "test-sub", "test-cancel", "test-active", "test-complete-cleanup"];
  for (const id of ids) {
    deleteSession(id);
  }
  vi.useRealTimers();
});

describe("createSession", () => {
  it("should create a session with correct properties", () => {
    const session = createSession("test-1", "/project", "abc123", "hash1", "staged");

    expect(session.reviewId).toBe("test-1");
    expect(session.projectPath).toBe("/project");
    expect(session.headCommit).toBe("abc123");
    expect(session.statusHash).toBe("hash1");
    expect(session.mode).toBe("staged");
    expect(session.events).toEqual([]);
    expect(session.isComplete).toBe(false);
    expect(session.isReady).toBe(false);
    expect(session.subscribers.size).toBe(0);
    expect(session.controller).toBeInstanceOf(AbortController);
  });

  it("should be retrievable via getSession", () => {
    createSession("test-1", "/project", "abc123", "hash1", "staged");
    expect(getSession("test-1")).toBeDefined();
  });
});

describe("getSession", () => {
  it("should return undefined for unknown id", () => {
    expect(getSession("nonexistent")).toBeUndefined();
  });
});

describe("markReady", () => {
  it("should set isReady to true", () => {
    createSession("test-1", "/project", "abc", "h", "staged");
    markReady("test-1");
    expect(getSession("test-1")!.isReady).toBe(true);
  });

  it("should be a no-op for unknown session", () => {
    expect(() => markReady("nonexistent")).not.toThrow();
  });
});

describe("addEvent", () => {
  it("should add event to session", () => {
    createSession("test-1", "/project", "abc", "h", "staged");
    const event: FullReviewStreamEvent = {
      type: "step_start",
      step: "diff",
      timestamp: "2024-01-01T00:00:00Z",
    };
    addEvent("test-1", event);
    expect(getSession("test-1")!.events).toHaveLength(1);
    expect(getSession("test-1")!.events[0]).toBe(event);
  });

  it("should not add events to completed session", () => {
    createSession("test-1", "/project", "abc", "h", "staged");
    markComplete("test-1");
    addEvent("test-1", {
      type: "step_start",
      step: "diff",
      timestamp: "2024-01-01T00:00:00Z",
    });
    expect(getSession("test-1")!.events).toHaveLength(0);
  });

  it("should notify subscribers", () => {
    createSession("test-sub", "/project", "abc", "h", "staged");
    const callback = vi.fn();
    subscribe("test-sub", callback);

    const event: FullReviewStreamEvent = {
      type: "step_start",
      step: "diff",
      timestamp: "2024-01-01T00:00:00Z",
    };
    addEvent("test-sub", event);

    expect(callback).toHaveBeenCalledWith(event);
  });
});

describe("markComplete", () => {
  it("should set isComplete and clear subscribers", () => {
    createSession("test-1", "/project", "abc", "h", "staged");
    const callback = vi.fn();
    subscribe("test-1", callback);

    markComplete("test-1");

    const session = getSession("test-1")!;
    expect(session.isComplete).toBe(true);
    expect(session.subscribers.size).toBe(0);
  });

  it("should schedule cleanup after 5 minutes", () => {
    createSession("test-complete-cleanup", "/project", "abc", "h", "staged");
    markComplete("test-complete-cleanup");

    expect(getSession("test-complete-cleanup")).toBeDefined();
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(getSession("test-complete-cleanup")).toBeUndefined();
  });
});

describe("subscribe", () => {
  it("should return unsubscribe function", () => {
    createSession("test-1", "/project", "abc", "h", "staged");
    const callback = vi.fn();
    const unsub = subscribe("test-1", callback);

    expect(unsub).toBeTypeOf("function");
    unsub!();

    addEvent("test-1", {
      type: "step_start",
      step: "diff",
      timestamp: "2024-01-01T00:00:00Z",
    });
    expect(callback).not.toHaveBeenCalled();
  });

  it("should return null for unknown session", () => {
    expect(subscribe("nonexistent", vi.fn())).toBeNull();
  });
});

describe("cancelSession", () => {
  it("should abort controller and mark complete", () => {
    createSession("test-cancel", "/project", "abc", "h", "staged");
    cancelSession("test-cancel");

    const session = getSession("test-cancel")!;
    expect(session.isComplete).toBe(true);
    expect(session.controller.signal.aborted).toBe(true);
  });

  it("should notify subscribers with error event", () => {
    createSession("test-cancel", "/project", "abc", "h", "staged");
    const callback = vi.fn();
    subscribe("test-cancel", callback);

    cancelSession("test-cancel");

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        error: expect.objectContaining({
          code: "SESSION_STALE",
        }),
      }),
    );
  });

  it("should not emit duplicate cancellation events", () => {
    createSession("test-cancel", "/project", "abc", "h", "staged");
    const callback = vi.fn();
    subscribe("test-cancel", callback);

    cancelSession("test-cancel");
    cancelSession("test-cancel");

    const session = getSession("test-cancel");
    const errorEvents = session?.events.filter((event) => event.type === "error");
    expect(errorEvents).toHaveLength(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should be a no-op for unknown session", () => {
    expect(() => cancelSession("nonexistent")).not.toThrow();
  });
});

describe("session limits", () => {
  afterEach(() => {
    // Clean up bulk sessions
    for (let i = 0; i < 55; i++) {
      deleteSession(`bulk-${i}`);
    }
  });

  it("should evict oldest session when MAX_SESSIONS reached", () => {
    // Create 50 sessions (the max)
    for (let i = 0; i < 50; i++) {
      vi.advanceTimersByTime(1); // ensure different startedAt
      createSession(`bulk-${i}`, "/project", "abc", "h", "staged");
    }

    // The 51st session should trigger eviction of the oldest
    createSession("bulk-50", "/project", "abc", "h", "staged");

    // Oldest session (bulk-0) should have been evicted
    expect(getSession("bulk-0")).toBeUndefined();
    // Newest should exist
    expect(getSession("bulk-50")).toBeDefined();
  });
});

describe("async subscriber error handling", () => {
  it("should catch rejected promises from async subscribers", async () => {
    createSession("test-sub", "/project", "abc", "h", "staged");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const asyncCallback = vi.fn().mockRejectedValue(new Error("async fail"));
    subscribe("test-sub", asyncCallback);

    addEvent("test-sub", {
      type: "step_start",
      step: "diff",
      timestamp: "2024-01-01T00:00:00Z",
    });

    expect(asyncCallback).toHaveBeenCalled();

    // Allow microtask queue to flush Promise rejection handler
    await Promise.resolve();
    expect(errorSpy).toHaveBeenCalled();
    const errorArg = errorSpy.mock.calls[0]?.[1];
    expect(errorArg).toBeInstanceOf(Error);
    errorSpy.mockRestore();
  });
});

describe("getActiveSessionForProject", () => {
  it("should find matching active session", () => {
    createSession("test-active", "/project", "abc", "hash1", "staged");
    markReady("test-active");

    const found = getActiveSessionForProject("/project", "abc", "hash1", "staged");
    expect(found?.reviewId).toBe("test-active");
  });

  it("should not find completed session", () => {
    createSession("test-active", "/project", "abc", "hash1", "staged");
    markReady("test-active");
    markComplete("test-active");

    expect(
      getActiveSessionForProject("/project", "abc", "hash1", "staged"),
    ).toBeUndefined();
  });

  it("should not find session that is not ready", () => {
    createSession("test-active", "/project", "abc", "hash1", "staged");

    expect(
      getActiveSessionForProject("/project", "abc", "hash1", "staged"),
    ).toBeUndefined();
  });

  it("should not match different mode", () => {
    createSession("test-active", "/project", "abc", "hash1", "staged");
    markReady("test-active");

    expect(
      getActiveSessionForProject("/project", "abc", "hash1", "unstaged"),
    ).toBeUndefined();
  });
});

describe("cancelStaleSessionsForProjectMode", () => {
  it("should cancel active sessions for same project and mode with mismatched git state", () => {
    createSession("test-active", "/project", "abc", "hash1", "staged");
    markReady("test-active");

    cancelStaleSessionsForProjectMode("/project", "staged", "abc", "hash2");

    expect(getSession("test-active")?.isComplete).toBe(true);
    expect(getSession("test-active")?.controller.signal.aborted).toBe(true);
  });

  it("should keep matching session state untouched", () => {
    createSession("test-active", "/project", "abc", "hash1", "staged");
    markReady("test-active");

    cancelStaleSessionsForProjectMode("/project", "staged", "abc", "hash1");

    expect(getSession("test-active")?.isComplete).toBe(false);
  });

  it("should not cancel sessions from a different mode", () => {
    createSession("test-active", "/project", "abc", "hash1", "unstaged");
    markReady("test-active");

    cancelStaleSessionsForProjectMode("/project", "staged", "abc", "hash2");

    expect(getSession("test-active")?.isComplete).toBe(false);
  });

  it("should skip cancellation when git identity is unavailable", () => {
    createSession("test-active", "/project", "abc", "hash1", "staged");
    markReady("test-active");

    cancelStaleSessionsForProjectMode("/project", "staged", "", "");

    expect(getSession("test-active")?.isComplete).toBe(false);
    expect(getSession("test-active")?.controller.signal.aborted).toBe(false);
  });
});
