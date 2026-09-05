import { afterEach, describe, expect, test, vi } from "vitest";
import { waitUntil } from "./wait-until";

afterEach(() => {
  vi.useRealTimers();
});

describe("waitUntil", () => {
  test("rejects when the predicate never becomes true", async () => {
    await expect(waitUntil(() => false, { timeoutMs: 0, intervalMs: 0 })).rejects.toThrow(
      /Timed out waiting for condition after \d+ms \(attempts: 1\)/,
    );
  });

  test("keeps polling until the wall-clock budget is spent, not a fixed attempt count", async () => {
    vi.useFakeTimers();
    const wait = waitUntil(() => false, { timeoutMs: 1_000, intervalMs: 100 });
    const rejection = expect(wait).rejects.toThrow(
      "Timed out waiting for condition after 1000ms (attempts: 11)",
    );

    await vi.advanceTimersByTimeAsync(1_000);

    await rejection;
  });

  test("resolves on the check where the predicate flips true", async () => {
    let calls = 0;
    await expect(waitUntil(() => ++calls === 2, { intervalMs: 0 })).resolves.toBeUndefined();
    expect(calls).toBe(2);
  });
});
