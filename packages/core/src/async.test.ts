import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { retry, timeout, debounce } from "./async.js";

describe("retry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns result on first successful attempt", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = await retry(fn);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and returns on success", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("success");

    const promise = retry(fn);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws after max attempts exceeded", async () => {
    const error = new Error("persistent failure");
    const fn = vi.fn().mockRejectedValue(error);

    const promise = retry(fn, { maxAttempts: 3 }).catch((e) => e);
    await vi.runAllTimersAsync();

    const result = await promise;
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe("persistent failure");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("respects custom maxAttempts", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));

    const promise = retry(fn, { maxAttempts: 5 }).catch((e) => e);
    await vi.runAllTimersAsync();

    const result = await promise;
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe("fail");
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it("uses exponential backoff with delays", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("success");

    const promise = retry(fn, { initialDelay: 100, maxAttempts: 3 });

    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(100);
    expect(fn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(200);
    expect(fn).toHaveBeenCalledTimes(3);

    const result = await promise;
    expect(result).toBe("success");
  });

  it("caps delay at maxDelay", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("success");

    const promise = retry(fn, { initialDelay: 1000, maxDelay: 1500, maxAttempts: 4 });

    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1500);
    expect(fn).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(1500);
    expect(fn).toHaveBeenCalledTimes(4);

    const result = await promise;
    expect(result).toBe("success");
  });
});

describe("timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns result if promise resolves before timeout", async () => {
    const promise = Promise.resolve("success");
    const result = await timeout(promise, 1000);
    expect(result).toBe("success");
  });

  it("throws if promise takes longer than timeout", async () => {
    const promise = new Promise((resolve) => setTimeout(() => resolve("success"), 2000));

    const timeoutPromise = timeout(promise, 1000).catch((e) => e);

    await vi.advanceTimersByTimeAsync(1000);

    const result = await timeoutPromise;
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe("Operation timed out");
  });

  it("uses custom error message", async () => {
    const promise = new Promise((resolve) => setTimeout(() => resolve("success"), 2000));

    const timeoutPromise = timeout(promise, 1000, "Custom timeout message").catch((e) => e);

    await vi.advanceTimersByTimeAsync(1000);

    const result = await timeoutPromise;
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe("Custom timeout message");
  });

  it("preserves rejection from original promise", async () => {
    const promise = Promise.reject(new Error("original error"));

    const result = await timeout(promise, 1000).catch((e) => e);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe("original error");
  });
});

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls function after delay", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("only calls function once for multiple rapid calls", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced();
    debounced();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("resets timer on each call", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(50);
    debounced();
    vi.advanceTimersByTime(50);
    debounced();
    vi.advanceTimersByTime(50);

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("passes arguments to the debounced function", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced("arg1", "arg2");

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith("arg1", "arg2");
  });

  it("uses the last call arguments when debouncing", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced("first");
    debounced("second");
    debounced("third");

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith("third");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
