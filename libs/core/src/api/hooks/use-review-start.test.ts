/**
 * @vitest-environment jsdom
 */

import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode, StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import { err, ok } from "../../result.js";
import { ReviewErrorCode } from "../../schemas/review/index.js";
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

    renderHook(() => useReviewStart(options), {
      wrapper: StrictModeWrapper,
    });

    // call-count IS the contract: resume must fire exactly once under StrictMode (effect dedups; double-fire would re-resume the same session and break the once-per-mount guarantee)
    await waitFor(() => expect(options.resume).toHaveBeenCalledTimes(1));
    expect(options.resume).toHaveBeenCalledWith("review-123");
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
});
