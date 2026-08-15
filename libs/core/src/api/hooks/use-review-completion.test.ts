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
    const completedAt = result.current.completedAt;
    expect(completedAt).toEqual(new Date());
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.isCompleting).toBe(false);
    expect(result.current.completedAt).toBe(completedAt);
    // call-count IS the contract: onComplete must fire exactly once when the completion delay elapses (no double-fire from timer + state change)
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("holds the completion 300ms longer when the report step already finished", () => {
    const onComplete = vi.fn();
    const initialProps = createOptions({
      isStreaming: true,
      hasStreamed: true,
      steps: [{ id: "report", label: "Report", status: "completed" }],
      onComplete,
    });

    const { result, rerender } = renderHook(
      (props: UseReviewCompletionOptions) => useReviewCompletion(props),
      { initialProps },
    );

    rerender({ ...initialProps, isStreaming: false, isComplete: true });
    expect(result.current.isCompleting).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.isCompleting).toBe(true);
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.isCompleting).toBe(false);
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
    expect(result.current.completedAt).not.toBeNull();

    act(() => {
      result.current.skipDelay();
    });

    // call-count IS the contract: skipDelay must fire onComplete exactly once (immediate fire)
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(result.current.isCompleting).toBe(false);
    expect(result.current.completedAt).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // call-count IS the contract: after skipDelay fires, the pending timer must NOT fire onComplete again (count stays at 1, no double-fire)
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("skipDelay emits nothing before the stream ends", () => {
    const onComplete = vi.fn();
    const onStreamComplete = vi.fn();
    const { result } = renderHook(
      (props: UseReviewCompletionOptions) => useReviewCompletion(props),
      {
        initialProps: createOptions({
          isStreaming: true,
          hasStreamed: true,
          onComplete,
          onStreamComplete,
        }),
      },
    );

    act(() => {
      result.current.skipDelay();
    });

    expect(onComplete).not.toHaveBeenCalled();
    expect(onStreamComplete).not.toHaveBeenCalled();
    expect(result.current.isCompleting).toBe(false);
    expect(result.current.completedAt).toBeNull();
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

  it("the delay timer calls the onComplete callback of the latest render", () => {
    const firstComplete = vi.fn();
    const secondComplete = vi.fn();
    const initialProps = createOptions({
      isStreaming: true,
      hasStreamed: true,
      onComplete: firstComplete,
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
      onComplete: secondComplete,
    });

    act(() => {
      vi.advanceTimersByTime(3000);
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
    expect(result.current.completedAt).toBeNull();

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

  it.each([
    { label: "streaming resumes", invalidation: { isStreaming: true } },
    { label: "an error arrives", invalidation: { error: "something broke" } },
    { label: "the run is cancelled", invalidation: { errorCode: ReviewErrorCode.CANCELLED } },
    { label: "the completion signal is withdrawn", invalidation: { isComplete: false } },
    { label: "the stream history is dropped", invalidation: { hasStreamed: false } },
  ])("cancels the running completion delay when $label before it elapses", ({
    invalidation,
  }: {
    invalidation: Partial<UseReviewCompletionOptions>;
  }) => {
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

    const completingProps = { ...initialProps, isStreaming: false, isComplete: true };
    rerender(completingProps);
    expect(result.current.isCompleting).toBe(true);
    expect(onStreamComplete).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onComplete).not.toHaveBeenCalled();

    rerender({ ...completingProps, ...invalidation });

    expect(result.current.isCompleting).toBe(false);
    expect(result.current.completedAt).toBeNull();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onComplete).not.toHaveBeenCalled();
    expect(onStreamComplete).toHaveBeenCalledTimes(1);
  });

  it("reports the second run's completion instant when a new stream starts without reset", () => {
    const initialProps = createOptions({ isStreaming: true, hasStreamed: true });
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const { result, rerender } = renderHook(
      (props: UseReviewCompletionOptions) => useReviewCompletion(props),
      { initialProps },
    );

    rerender({ ...initialProps, isStreaming: false, isComplete: true });
    const firstCompletedAt = result.current.completedAt;
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.completedAt).toEqual(firstCompletedAt);

    // A second review starts on the same hook instance without anyone calling reset().
    rerender({ ...initialProps, isStreaming: true, isComplete: false });
    expect(result.current.completedAt).toBeNull();

    vi.setSystemTime(new Date("2026-01-01T00:05:00.000Z"));
    rerender({ ...initialProps, isStreaming: false, isComplete: true });

    expect(result.current.isCompleting).toBe(true);
    expect(result.current.completedAt).toEqual(new Date("2026-01-01T00:05:00.000Z"));
  });

  it("does not fire onComplete when unmounted before the completion delay elapses", () => {
    const onComplete = vi.fn();
    const initialProps = createOptions({
      isStreaming: true,
      hasStreamed: true,
      onComplete,
    });

    const { rerender, unmount } = renderHook(
      (props: UseReviewCompletionOptions) => useReviewCompletion(props),
      { initialProps },
    );

    rerender({ ...initialProps, isStreaming: false, isComplete: true });
    expect(onComplete).not.toHaveBeenCalled();

    unmount();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onComplete).not.toHaveBeenCalled();
  });
});
