import type { FullReviewStreamEvent } from "@diffgazer/core/schemas/events";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("session maintenance interval", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it("re-arms one maintenance interval after shutdown and times out one idle session once", async () => {
    vi.useFakeTimers();
    vi.resetModules();
    const store = await import("./store.js");

    expect(vi.getTimerCount()).toBe(1);
    store.shutdownSessions();
    expect(vi.getTimerCount()).toBe(0);

    store.startSessionMaintenance();
    store.startSessionMaintenance();
    expect(vi.getTimerCount()).toBe(1);

    let monotonicNow = 0;
    const reviewId = "post-restart-idle";
    store.createSession(reviewId, {
      projectPath: "/tmp/project",
      headCommit: "head",
      statusHash: "status",
      statusHashKind: "full",
      mode: "staged",
      monotonicNow: () => monotonicNow,
    });
    const received: FullReviewStreamEvent[] = [];
    store.subscribe(reviewId, (event) => received.push(event));
    monotonicNow = 30 * 60 * 1000 + 1;

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    expect(received).toEqual([
      expect.objectContaining({
        type: "error",
        error: expect.objectContaining({ code: ReviewErrorCode.SESSION_TIMEOUT }),
      }),
    ]);
    expect(store.getSession(reviewId)).toBeUndefined();
    expect(vi.getTimerCount()).toBe(1);
    store.shutdownSessions();
  });
});
