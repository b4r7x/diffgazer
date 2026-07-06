/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReviewErrorCode } from "../../schemas/review/index.js";
import { type UseReviewCompletionOptions, useReviewCompletion } from "./use-review-completion.js";

function createOptions(
  overrides: Partial<UseReviewCompletionOptions> = {},
): UseReviewCompletionOptions {
  return {
    isStreaming: false,
    isComplete: false,
    error: null,
    errorCode: null,
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

    rerender({ ...initialProps, isStreaming: false, isComplete: true });

    expect(result.current.isCompleting).toBe(true);
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.isCompleting).toBe(false);
    // call-count IS the contract: onComplete must fire exactly once when the completion delay elapses (no double-fire from timer + state change)
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("fires onStreamComplete immediately when streaming stops", () => {
    const onComplete = vi.fn();
    const onStreamComplete = vi.fn();
    const initialProps = createOptions({
      isStreaming: true,
      hasStreamed: true,
      onComplete,
      onStreamComplete,
    });

    const { rerender } = renderHook(
      (props: UseReviewCompletionOptions) => useReviewCompletion(props),
      { initialProps },
    );

    rerender({ ...initialProps, isStreaming: false, isComplete: true });

    expect(onStreamComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("keeps the delayed completion timer when onStreamComplete changes after streaming stops", () => {
    const onComplete = vi.fn();
    const firstStreamComplete = vi.fn();
    const secondStreamComplete = vi.fn();
    const initialProps = createOptions({
      isStreaming: true,
      hasStreamed: true,
      onComplete,
      onStreamComplete: firstStreamComplete,
    });

    const { rerender } = renderHook(
      (props: UseReviewCompletionOptions) => useReviewCompletion(props),
      { initialProps },
    );

    rerender({ ...initialProps, isStreaming: false, isComplete: true });
    rerender({
      ...initialProps,
      isStreaming: false,
      isComplete: true,
      onStreamComplete: secondStreamComplete,
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(firstStreamComplete).toHaveBeenCalledTimes(1);
    expect(secondStreamComplete).not.toHaveBeenCalled();
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

    rerender({ ...initialProps, isStreaming: false, isComplete: true, error: "something broke" });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onComplete).not.toHaveBeenCalled();
  });

  it("does NOT fire onComplete when the stream was cancelled", () => {
    const onComplete = vi.fn();
    const initialProps = createOptions({
      isStreaming: true,
      hasStreamed: true,
      error: null,
      errorCode: null,
      onComplete,
    });

    const { rerender } = renderHook(
      (props: UseReviewCompletionOptions) => useReviewCompletion(props),
      { initialProps },
    );

    rerender({
      ...initialProps,
      isStreaming: false,
      isComplete: true,
      errorCode: ReviewErrorCode.CANCELLED,
    });

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

    rerender({ ...initialProps, isStreaming: false, isComplete: true });
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

  it("skipDelay calls the current render onComplete callback", () => {
    const firstComplete = vi.fn();
    const secondComplete = vi.fn();
    const initialProps = createOptions({
      isStreaming: true,
      hasStreamed: true,
      onComplete: firstComplete,
    });

    const { result, rerender } = renderHook(
      (props: UseReviewCompletionOptions) => useReviewCompletion(props),
      { initialProps },
    );

    rerender({ ...initialProps, isStreaming: false, isComplete: true });
    rerender({
      ...initialProps,
      isStreaming: false,
      isComplete: true,
      onComplete: secondComplete,
    });

    act(() => {
      result.current.skipDelay();
    });

    expect(firstComplete).not.toHaveBeenCalled();
    expect(secondComplete).toHaveBeenCalledTimes(1);
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

    rerender({ ...initialProps, isStreaming: false, isComplete: true });
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

  it("does NOT fire completion callbacks when streaming stops without a completion signal", () => {
    const onComplete = vi.fn();
    const onStreamComplete = vi.fn();
    const initialProps = createOptions({
      isStreaming: true,
      hasStreamed: true,
      onComplete,
      onStreamComplete,
    });

    const { result, rerender } = renderHook(
      (props: UseReviewCompletionOptions) => useReviewCompletion(props),
      { initialProps },
    );

    rerender({ ...initialProps, isStreaming: false, isComplete: false });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.isCompleting).toBe(false);
    expect(onStreamComplete).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
