import { describe, expect, it, vi } from "vitest";
import { composeExecutionDeadline } from "./deadline.js";

describe("composeExecutionDeadline", () => {
  it("aborts and reports expiry when the admitted wall time elapses", async () => {
    vi.useFakeTimers();
    const deadline = composeExecutionDeadline(1_000);

    expect(deadline.signal.aborted).toBe(false);
    expect(deadline.expired()).toBe(false);

    vi.advanceTimersByTime(1_001);
    await Promise.resolve();

    expect(deadline.signal.aborted).toBe(true);
    expect(deadline.expired()).toBe(true);

    deadline.dispose();
    vi.useRealTimers();
  });

  it("forwards caller cancellation without reporting expiry", () => {
    const parent = new AbortController();
    const deadline = composeExecutionDeadline(60_000, parent.signal);

    parent.abort("caller-cancelled");

    expect(deadline.signal.aborted).toBe(true);
    expect(deadline.signal.reason).toBe("caller-cancelled");
    expect(deadline.expired()).toBe(false);

    deadline.dispose();
  });

  it("starts aborted when the caller signal was already aborted", () => {
    const parent = new AbortController();
    parent.abort("already-cancelled");

    const deadline = composeExecutionDeadline(60_000, parent.signal);

    expect(deadline.signal.aborted).toBe(true);
    expect(deadline.expired()).toBe(false);

    deadline.dispose();
  });

  it("leaves no armed timer when the caller signal was already aborted", () => {
    vi.useFakeTimers();
    const parent = new AbortController();
    parent.abort("already-cancelled");

    const deadline = composeExecutionDeadline(60_000, parent.signal);

    // The composed signal aborted during construction, so the deadline disposed
    // itself; nothing is left armed for the caller's finally to catch.
    expect(vi.getTimerCount()).toBe(0);

    deadline.dispose();
    vi.useRealTimers();
  });

  it("reports remaining budget that shrinks over time", () => {
    vi.useFakeTimers();
    const deadline = composeExecutionDeadline(5_000);

    expect(deadline.remainingMs()).toBe(5_000);
    vi.advanceTimersByTime(2_000);
    expect(deadline.remainingMs()).toBe(3_000);

    deadline.dispose();
    vi.useRealTimers();
  });
});
