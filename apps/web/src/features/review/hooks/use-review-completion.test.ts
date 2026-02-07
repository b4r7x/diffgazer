import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useReviewCompletion } from "./use-review-completion";
import type { StepState } from "@stargazer/schemas/events";
import type { ReviewIssue } from "@stargazer/schemas/review";

const REPORT_COMPLETE_DELAY_MS = 2300;
const DEFAULT_COMPLETE_DELAY_MS = 400;

function makeStep(id: string, status: StepState["status"]): StepState {
  return { id, label: id, status } as StepState;
}

function defaultProps(overrides: Partial<Parameters<typeof useReviewCompletion>[0]> = {}) {
  return {
    isStreaming: false,
    error: null,
    hasStreamed: true,
    steps: [] as StepState[],
    issues: [] as ReviewIssue[],
    reviewId: "r-1",
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

  it("should fire onComplete after delay when streaming stops", () => {
    const onComplete = vi.fn();
    const props = defaultProps({ isStreaming: true, onComplete });

    const { rerender } = renderHook(
      (p) => useReviewCompletion(p),
      { initialProps: props }
    );

    expect(onComplete).not.toHaveBeenCalled();

    // Transition from streaming to not streaming
    rerender({ ...props, isStreaming: false });

    // Not called yet — waiting for delay
    expect(onComplete).not.toHaveBeenCalled();

    vi.advanceTimersByTime(DEFAULT_COMPLETE_DELAY_MS);

    expect(onComplete).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledWith({ issues: [], reviewId: "r-1" });
  });

  it("should use REPORT_COMPLETE_DELAY_MS when report step is completed", () => {
    const onComplete = vi.fn();
    const steps = [makeStep("report", "completed")];
    const props = defaultProps({ isStreaming: true, onComplete, steps });

    const { rerender } = renderHook(
      (p) => useReviewCompletion(p),
      { initialProps: props }
    );

    rerender({ ...props, isStreaming: false });

    // Should NOT have fired at DEFAULT_COMPLETE_DELAY_MS
    vi.advanceTimersByTime(DEFAULT_COMPLETE_DELAY_MS);
    expect(onComplete).not.toHaveBeenCalled();

    // Should fire at REPORT_COMPLETE_DELAY_MS
    vi.advanceTimersByTime(REPORT_COMPLETE_DELAY_MS - DEFAULT_COMPLETE_DELAY_MS);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("should use DEFAULT_COMPLETE_DELAY_MS when report step not completed", () => {
    const onComplete = vi.fn();
    const steps = [makeStep("report", "running")];
    const props = defaultProps({ isStreaming: true, onComplete, steps });

    const { rerender } = renderHook(
      (p) => useReviewCompletion(p),
      { initialProps: props }
    );

    rerender({ ...props, isStreaming: false });

    vi.advanceTimersByTime(DEFAULT_COMPLETE_DELAY_MS);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("should not fire onComplete when error is present", () => {
    const onComplete = vi.fn();
    const props = defaultProps({ isStreaming: true, onComplete });

    const { rerender } = renderHook(
      (p) => useReviewCompletion(p),
      { initialProps: props }
    );

    rerender({ ...props, isStreaming: false, error: "Something went wrong" });

    vi.advanceTimersByTime(REPORT_COMPLETE_DELAY_MS);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("should clear timeout on unmount", () => {
    const onComplete = vi.fn();
    const props = defaultProps({ isStreaming: true, onComplete });

    const { rerender, unmount } = renderHook(
      (p) => useReviewCompletion(p),
      { initialProps: props }
    );

    rerender({ ...props, isStreaming: false });
    unmount();

    vi.advanceTimersByTime(REPORT_COMPLETE_DELAY_MS);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
