import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createToastTimers } from "./toast-timers";

describe("createToastTimers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pause/resume accounts for elapsed time", () => {
    const elapsed: string[] = [];
    const timers = createToastTimers({ onElapsed: (id) => elapsed.push(id) });

    timers.schedule("a", 3000);
    vi.advanceTimersByTime(1000);
    timers.pause();
    vi.advanceTimersByTime(10000);
    expect(elapsed).toEqual([]);

    timers.resume();
    vi.advanceTimersByTime(2000);
    expect(elapsed).toEqual(["a"]);
  });
});
