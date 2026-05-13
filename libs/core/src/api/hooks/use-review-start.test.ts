/**
 * @vitest-environment jsdom
 */
import { createElement, StrictMode, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { err, ok } from "@diffgazer/core/result";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import { useReviewStart, type UseReviewStartOptions } from "./use-review-start.js";

function StrictModeWrapper({ children }: { children: ReactNode }) {
  return createElement(StrictMode, null, children);
}

function createOptions(
  overrides: Partial<UseReviewStartOptions> = {},
): UseReviewStartOptions {
  return {
    mode: "unstaged",
    configLoading: false,
    settingsLoading: false,
    isConfigured: true,
    resume: vi.fn<UseReviewStartOptions["resume"]>().mockResolvedValue(ok(undefined)),
    ...overrides,
  };
}

describe("useReviewStart", () => {
  it("resumes a review when reviewId is provided", async () => {
    const options = createOptions({ reviewId: "review-123" });

    renderHook(() => useReviewStart(options), {
      wrapper: StrictModeWrapper,
    });

    await waitFor(() => expect(options.resume).toHaveBeenCalledTimes(1));
    expect(options.resume).toHaveBeenCalledWith("review-123");
  });

  it("does not resume when reviewId matches the current live stream", async () => {
    const options = createOptions({
      reviewId: "live-review",
      currentReviewId: "live-review",
    });

    const { result } = renderHook(() => useReviewStart(options), {
      wrapper: StrictModeWrapper,
    });

    await waitFor(() => expect(result.current.hasStarted).toBe(false));

    expect(options.resume).not.toHaveBeenCalled();
  });

  it("does nothing when no reviewId is provided", async () => {
    const options = createOptions();

    const { result } = renderHook(() => useReviewStart(options), {
      wrapper: StrictModeWrapper,
    });

    await waitFor(() => expect(result.current.hasStarted).toBe(false));

    expect(options.resume).not.toHaveBeenCalled();
  });

  it("does nothing while config is loading", async () => {
    const options = createOptions({
      reviewId: "review-123",
      configLoading: true,
    });

    const { result } = renderHook(() => useReviewStart(options), {
      wrapper: StrictModeWrapper,
    });

    await waitFor(() => expect(result.current.hasStarted).toBe(false));
    expect(options.resume).not.toHaveBeenCalled();
  });

  it("calls onStaleSession when resume returns SESSION_STALE", async () => {
    const onStale = vi.fn();
    const options = createOptions({
      reviewId: "stale-review",
      resume: vi
        .fn<UseReviewStartOptions["resume"]>()
        .mockResolvedValue(err({ code: ReviewErrorCode.SESSION_STALE, message: "stale" })),
      onStaleSession: onStale,
    });

    renderHook(() => useReviewStart(options), {
      wrapper: StrictModeWrapper,
    });

    await waitFor(() => expect(onStale).toHaveBeenCalledTimes(1));
  });

  it("does nothing while settings are loading", async () => {
    const options = createOptions({
      reviewId: "review-123",
      settingsLoading: true,
    });

    const { result } = renderHook(() => useReviewStart(options), {
      wrapper: StrictModeWrapper,
    });

    await waitFor(() => expect(result.current.hasStarted).toBe(false));
    expect(options.resume).not.toHaveBeenCalled();
  });

  it("does nothing when isConfigured is false", async () => {
    const options = createOptions({
      reviewId: "review-123",
      isConfigured: false,
    });

    const { result } = renderHook(() => useReviewStart(options), {
      wrapper: StrictModeWrapper,
    });

    await waitFor(() => expect(result.current.hasStarted).toBe(false));
    expect(options.resume).not.toHaveBeenCalled();
  });

  it("calls onNotFoundInSession when resume returns SESSION_NOT_FOUND", async () => {
    const onNotFound = vi.fn();
    const options = createOptions({
      reviewId: "missing-review",
      resume: vi
        .fn<UseReviewStartOptions["resume"]>()
        .mockResolvedValue(err({ code: ReviewErrorCode.SESSION_NOT_FOUND, message: "not found" })),
      onNotFoundInSession: onNotFound,
    });

    renderHook(() => useReviewStart(options), {
      wrapper: StrictModeWrapper,
    });

    await waitFor(() => expect(onNotFound).toHaveBeenCalledTimes(1));
    expect(onNotFound).toHaveBeenCalledWith("missing-review");
  });
});
