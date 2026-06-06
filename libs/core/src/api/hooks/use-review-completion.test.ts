/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type UseReviewCompletionOptions,
  useReviewCompletion,
} from "./use-review-completion.js";

function createOptions(
  overrides: Partial<UseReviewCompletionOptions> = {},
): UseReviewCompletionOptions {
  return {
    isStreaming: false,
    error: null,
    hasStreamed: false,
    steps: [],
    onComplete: vi.fn(),
    ...overrides,
  };
}

describe("useReviewCompletion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires onComplete after delay when streaming stops", () => {
    const onComplete = vi.fn();
    const initialProps = createOptions({
      isStreaming: true,
      hasStreamed: true,
      onComplete,
    });

    const { result, rerender } = renderHook(
      (props: UseReviewCompletionOptions) => useReviewCompletion(props),
      { initialProps },
    );

    expect(result.current.isCompleting).toBe(false);

    rerender({ ...initialProps, isStreaming: false });

    expect(result.current.isCompleting).toBe(true);
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.isCompleting).toBe(false);
    // call-count IS the contract: onComplete must fire exactly once when the completion delay elapses (no double-fire from timer + state change)
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire onComplete when error is present", () => {
    const onComplete = vi.fn();
    const initialProps = createOptions({
      isStreaming: true,
      hasStreamed: true,
      error: null,
      onComplete,
    });

    const { rerender } = renderHook(
      (props: UseReviewCompletionOptions) => useReviewCompletion(props),
      { initialProps },
    );

    rerender({ ...initialProps, isStreaming: false, error: "something broke" });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onComplete).not.toHaveBeenCalled();
  });

  it("skipDelay fires onComplete immediately", () => {
    const onComplete = vi.fn();
    const initialProps = createOptions({
      isStreaming: true,
      hasStreamed: true,
      onComplete,
    });

    const { result, rerender } = renderHook(
      (props: UseReviewCompletionOptions) => useReviewCompletion(props),
      { initialProps },
    );

    rerender({ ...initialProps, isStreaming: false });
    expect(result.current.isCompleting).toBe(true);

    act(() => {
      result.current.skipDelay();
    });

    // call-count IS the contract: skipDelay must fire onComplete exactly once (immediate fire)
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(result.current.isCompleting).toBe(false);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // call-count IS the contract: after skipDelay fires, the pending timer must NOT fire onComplete again (count stays at 1, no double-fire)
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("reset clears completing state and cancels timer", () => {
    const onComplete = vi.fn();
    const initialProps = createOptions({
      isStreaming: true,
      hasStreamed: true,
      onComplete,
    });

    const { result, rerender } = renderHook(
      (props: UseReviewCompletionOptions) => useReviewCompletion(props),
      { initialProps },
    );

    rerender({ ...initialProps, isStreaming: false });
    expect(result.current.isCompleting).toBe(true);

    act(() => {
      result.current.reset();
    });

    expect(result.current.isCompleting).toBe(false);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onComplete).not.toHaveBeenCalled();
  });
});
