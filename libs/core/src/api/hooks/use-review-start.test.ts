/**
 * @vitest-environment jsdom
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode, StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import { err, ok, type Result } from "../../result.js";
import type { StreamReviewError } from "../../review/index.js";
import { ReviewErrorCode } from "../../schemas/review/index.js";
import { createDeferred } from "../../testing/deferred.js";
import { type UseReviewStartOptions, useReviewStart } from "./use-review-start.js";

function StrictModeWrapper({ children }: { children: ReactNode }) {
  return createElement(StrictMode, null, children);
}

function createOptions(overrides: Partial<UseReviewStartOptions> = {}): UseReviewStartOptions {
  return {
    configLoading: false,
    settingsLoading: false,
    isConfigured: true,
    resume: vi.fn<UseReviewStartOptions["resume"]>().mockResolvedValue(ok(undefined)),
    ...overrides,
  };
}

describe("useReviewStart", () => {
  it("resumes the supplied review id when configured and not loading", async () => {
    const options = createOptions({ reviewId: "review-123" });

    const { result } = renderHook(() => useReviewStart(options), {
      wrapper: StrictModeWrapper,
    });

    // call-count IS the contract: resume must fire exactly once under StrictMode (effect dedups; double-fire would re-resume the same session and break the once-per-mount guarantee)
    await waitFor(() => {
      expect(options.resume).toHaveBeenCalledTimes(1);
      expect(result.current.hasStarted).toBe(true);
      expect(result.current.hasStreamed).toBe(true);
    });
    expect(options.resume).toHaveBeenCalledWith("review-123");
  });

  it("withholds resume until both loading gates clear, then resumes the supplied review id exactly once without remounting", async () => {
    const initialProps = createOptions({
      reviewId: "review-123",
      configLoading: true,
      settingsLoading: true,
    });

    const { result, rerender } = renderHook(
      (props: UseReviewStartOptions) => useReviewStart(props),
      { wrapper: StrictModeWrapper, initialProps },
    );

    rerender({ ...initialProps, configLoading: false });
    expect(result.current.hasStarted).toBe(false);
    expect(initialProps.resume).not.toHaveBeenCalled();

    rerender({ ...initialProps, configLoading: false, settingsLoading: false });

    await waitFor(() => expect(initialProps.resume).toHaveBeenCalledTimes(1));
    expect(initialProps.resume).toHaveBeenCalledWith("review-123");
  });

  it.each([
    {
      label: "reviewId=undefined",
      overrides: {} as Partial<UseReviewStartOptions>,
    },
    {
      label: "reviewId='live-review' matches currentReviewId='live-review'",
      overrides: {
        reviewId: "live-review",
        currentReviewId: "live-review",
      } as Partial<UseReviewStartOptions>,
    },
    {
      label: "configLoading=true",
      overrides: { reviewId: "review-123", configLoading: true } as Partial<UseReviewStartOptions>,
    },
    {
      label: "settingsLoading=true",
      overrides: {
        reviewId: "review-123",
        settingsLoading: true,
      } as Partial<UseReviewStartOptions>,
    },
    {
      label: "isConfigured=false",
      overrides: { reviewId: "review-123", isConfigured: false } as Partial<UseReviewStartOptions>,
    },
  ])("does not resume and stays not-started when $label", async ({ overrides }) => {
    const options = createOptions(overrides);

    const { result } = renderHook(() => useReviewStart(options), {
      wrapper: StrictModeWrapper,
    });

    await waitFor(() => expect(result.current.hasStarted).toBe(false));

    expect(options.resume).not.toHaveBeenCalled();
  });

  it("invokes onStaleSession when the resumed session is stale (SESSION_STALE)", async () => {
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

    // call-count IS the contract: stale-session callback must fire exactly once under StrictMode (no double-notification on the consumer)
    await waitFor(() => expect(onStale).toHaveBeenCalledTimes(1));
  });

  it("invokes onNotFoundInSession with the missing review id (SESSION_NOT_FOUND)", async () => {
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

    // call-count IS the contract: not-found callback must fire exactly once under StrictMode (no double-notification on the consumer)
    await waitFor(() => expect(onNotFound).toHaveBeenCalledTimes(1));
    expect(onNotFound).toHaveBeenCalledWith("missing-review");
  });

  it("allows an explicit live resume without setup", async () => {
    const liveResume = vi.fn<UseReviewStartOptions["resume"]>().mockResolvedValue(ok(undefined));

    renderHook(
      () =>
        useReviewStart({
          configLoading: false,
          settingsLoading: false,
          isConfigured: false,
          allowResumeWithoutSetup: true,
          reviewId: "live-review",
          resume: liveResume,
        }),
      { wrapper: StrictModeWrapper },
    );

    await waitFor(() => expect(liveResume).toHaveBeenCalledWith("live-review"));
  });

  it("does not invoke termination callbacks when unmounted before deferred resume settles", async () => {
    const deferred = createDeferred<Result<void, StreamReviewError>>();
    const onStale = vi.fn();
    const onNotFound = vi.fn();
    const options = createOptions({
      reviewId: "review-123",
      resume: vi.fn<UseReviewStartOptions["resume"]>().mockReturnValue(deferred.promise),
      onStaleSession: onStale,
      onNotFoundInSession: onNotFound,
    });

    const { unmount } = renderHook(() => useReviewStart(options), {
      wrapper: StrictModeWrapper,
    });

    await waitFor(() => expect(options.resume).toHaveBeenCalledTimes(1));
    unmount();

    await act(async () => {
      deferred.resolve(err({ code: ReviewErrorCode.SESSION_STALE, message: "stale" }));
      await deferred.promise;
    });

    expect(onStale).not.toHaveBeenCalled();
    expect(onNotFound).not.toHaveBeenCalled();
  });
});
