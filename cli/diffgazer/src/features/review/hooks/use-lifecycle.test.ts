/**
 * @vitest-environment jsdom
 */
import type { UseReviewLifecycleBaseOptions } from "@diffgazer/core/api/hooks";
import { ReviewErrorCode, type ReviewMode } from "@diffgazer/core/schemas/review";
import { makeCreateReviewResponse } from "@diffgazer/core/testing/factories";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { makeReviewLifecycleBase } from "../../../testing/review-lifecycle-base";

const apiMocks = vi.hoisted(() => ({
  clearActiveSession: vi.fn(),
  createReview: vi.fn(),
  useCreateReview: vi.fn(),
  useInit: vi.fn(),
  useReviewLifecycleBase: vi.fn(),
}));

const CREATED_REVIEW_ID = "22222222-2222-4222-8222-222222222222";

vi.mock("@diffgazer/core/api/hooks", () => ({
  useCreateReview: apiMocks.useCreateReview,
  useInit: apiMocks.useInit,
  useReviewLifecycleBase: apiMocks.useReviewLifecycleBase,
  useReviewSessionCache: () => ({
    clearActiveSession: apiMocks.clearActiveSession,
  }),
}));

import { getDisplayPhase, useReviewLifecycle } from "./use-lifecycle";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  apiMocks.createReview.mockImplementation(async ({ mode = "staged" }: { mode?: ReviewMode }) =>
    makeCreateReviewResponse({ reviewId: CREATED_REVIEW_ID, session: { mode } }),
  );
  apiMocks.useCreateReview.mockReturnValue({ mutateAsync: apiMocks.createReview });
  apiMocks.useInit.mockReturnValue({
    data: {
      config: { provider: "gemini", model: "gemini-2.5-flash" },
      configured: true,
    },
    isLoading: false,
  });
  apiMocks.useReviewLifecycleBase.mockReturnValue(makeReviewLifecycleBase());
});

describe("getDisplayPhase", () => {
  test("returns 'summary' when the start request failed", () => {
    const result = getDisplayPhase({
      hasStartFailed: true,
      hasStarted: false,
      isCompleting: false,
      phase: "streaming",
    });
    expect(result).toBe("summary");
  });

  test("returns 'loading' before the lifecycle has started", () => {
    const result = getDisplayPhase({
      hasStartFailed: false,
      hasStarted: false,
      isCompleting: false,
      phase: "streaming",
    });
    expect(result).toBe("loading");
  });

  test("returns 'completing' while the lifecycle is completing", () => {
    const result = getDisplayPhase({
      hasStartFailed: false,
      hasStarted: true,
      isCompleting: true,
      phase: "streaming",
    });
    expect(result).toBe("completing");
  });

  test("falls through to the explicit phase when nothing else matches", () => {
    expect(
      getDisplayPhase({
        hasStartFailed: false,
        hasStarted: true,
        isCompleting: false,
        phase: "streaming",
      }),
    ).toBe("streaming");
    expect(
      getDisplayPhase({
        hasStartFailed: false,
        hasStarted: true,
        isCompleting: false,
        phase: "results",
      }),
    ).toBe("results");
  });

  test("start failure takes precedence over an unstarted lifecycle", () => {
    const result = getDisplayPhase({
      hasStartFailed: true,
      hasStarted: false,
      isCompleting: true,
      phase: "streaming",
    });
    expect(result).toBe("summary");
  });
});

describe("useReviewLifecycle active-session cache", () => {
  test("clears the review-scoped active session as soon as the stream completes", () => {
    let onStreamComplete: (() => void) | undefined;
    apiMocks.useReviewLifecycleBase.mockImplementation((options: UseReviewLifecycleBaseOptions) => {
      onStreamComplete = options.onStreamComplete;
      return makeReviewLifecycleBase({ reviewId: "stream-review" });
    });

    renderHook(() => useReviewLifecycle({ mode: "staged", reviewId: "stream-review" }));

    act(() => {
      onStreamComplete?.();
    });

    expect(apiMocks.clearActiveSession).toHaveBeenCalledWith("staged", "stream-review");
  });

  test("clears the review-scoped active session when no diff is reported", async () => {
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({
        error: "No staged changes found",
        errorCode: ReviewErrorCode.NO_DIFF,
        gate: "no-diff",
        isNoDiffError: true,
        reviewId: "no-diff-review",
      }),
    );

    renderHook(() => useReviewLifecycle({ mode: "staged", reviewId: "no-diff-review" }));

    await waitFor(() => {
      expect(apiMocks.clearActiveSession).toHaveBeenCalledWith("staged", "no-diff-review");
    });
  });

  test("clears the callback review id when a resumed session is not found", () => {
    let onNotFound: ((reviewId: string) => void) | undefined;
    apiMocks.useReviewLifecycleBase.mockImplementation((options: UseReviewLifecycleBaseOptions) => {
      onNotFound = options.onNotFoundInSession;
      return makeReviewLifecycleBase({ reviewId: null });
    });

    const { result } = renderHook(() =>
      useReviewLifecycle({ mode: "unstaged", reviewId: "route-review" }),
    );

    act(() => {
      onNotFound?.("missing-review");
    });

    expect(apiMocks.clearActiveSession).toHaveBeenCalledWith("unstaged", "missing-review");
    expect(result.current.state.error).toBe("Review session not found.");
  });

  test("clears the current review id when a resumed session is stale", () => {
    let onStale: ((code: "SESSION_TIMEOUT") => void) | undefined;
    apiMocks.useReviewLifecycleBase.mockImplementation((options: UseReviewLifecycleBaseOptions) => {
      onStale = options.onStaleSession;
      return makeReviewLifecycleBase({ reviewId: null });
    });

    renderHook(() => useReviewLifecycle({ mode: "unstaged", reviewId: "stale-review" }));

    act(() => {
      onStale?.("SESSION_TIMEOUT");
    });

    expect(apiMocks.clearActiveSession).toHaveBeenCalledWith("unstaged", "stale-review");
  });

  test("clears the review-scoped active session after successful cancel", async () => {
    const cancel = vi.fn(async () => null);
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({ cancel, reviewId: "cancel-review" }),
    );

    const { result } = renderHook(() => useReviewLifecycle({ mode: "staged" }));

    await act(async () => {
      await result.current.cancel();
    });

    expect(cancel).toHaveBeenCalledWith("cancel-review");
    expect(apiMocks.clearActiveSession).toHaveBeenCalledWith("staged", "cancel-review");
    const cancelCallOrder = cancel.mock.invocationCallOrder[0];
    const clearCallOrder = apiMocks.clearActiveSession.mock.invocationCallOrder[0];
    if (cancelCallOrder === undefined || clearCallOrder === undefined) {
      throw new Error("Expected cancel and active-session clear calls.");
    }
    expect(cancelCallOrder).toBeLessThan(clearCallOrder);
  });

  test("does not clear the active session when cancel fails", async () => {
    const cancel = vi.fn(async () => "cancel failed");
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({ cancel, reviewId: "cancel-review" }),
    );

    const { result } = renderHook(() => useReviewLifecycle({ mode: "staged" }));

    await act(async () => {
      await result.current.cancel();
    });

    expect(apiMocks.clearActiveSession).not.toHaveBeenCalled();
  });

  test("preserves the active session on local reset unless terminal clearing is requested", () => {
    const abort = vi.fn();
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({ abort, isStreaming: true, reviewId: "running-review" }),
    );

    const { result } = renderHook(() => useReviewLifecycle({ mode: "staged" }));

    act(() => {
      result.current.reset();
    });

    expect(abort).toHaveBeenCalledTimes(1);
    expect(apiMocks.clearActiveSession).not.toHaveBeenCalled();

    act(() => {
      result.current.reset({ clearActiveSession: true });
    });

    expect(apiMocks.clearActiveSession).toHaveBeenCalledWith("staged", "running-review");
  });
});

describe("useReviewLifecycle resume and start routing", () => {
  test("binds lifecycle resume to the newly created review after switching modes", async () => {
    apiMocks.useReviewLifecycleBase.mockImplementation((options: UseReviewLifecycleBaseOptions) =>
      makeReviewLifecycleBase({ reviewId: options.reviewId ?? null }),
    );

    const { result, rerender } = renderHook(() =>
      useReviewLifecycle({ mode: "staged", reviewId: "old-review" }),
    );

    await act(async () => {
      await result.current.start("unstaged");
    });
    rerender();

    expect(apiMocks.createReview).toHaveBeenCalledWith({ mode: "unstaged" });
    await waitFor(() => {
      const reviewIds = apiMocks.useReviewLifecycleBase.mock.calls.map(
        ([options]) => (options as UseReviewLifecycleBaseOptions).reviewId,
      );
      expect(reviewIds).toContain(CREATED_REVIEW_ID);
    });
  });

  test("marks active-session resume as setup-independent", () => {
    renderHook(() =>
      useReviewLifecycle({
        mode: "staged",
        reviewId: "active-review",
        allowResumeWithoutSetup: true,
      }),
    );

    expect(apiMocks.useReviewLifecycleBase).toHaveBeenLastCalledWith(
      expect.objectContaining({
        allowResumeWithoutSetup: true,
        reviewId: "active-review",
      }),
    );
  });

  test("does not create a new review while provider setup is incomplete", async () => {
    apiMocks.useInit.mockReturnValue({
      data: {
        config: { provider: null, model: null },
        configured: false,
      },
      isLoading: false,
    });
    apiMocks.useReviewLifecycleBase.mockReturnValue(
      makeReviewLifecycleBase({ gate: "unconfigured" }),
    );

    const { result } = renderHook(() => useReviewLifecycle({ mode: "staged" }));

    await act(async () => {
      result.current.start("staged");
    });

    expect(apiMocks.createReview).not.toHaveBeenCalled();
    expect(result.current.state.gate).toBe("unconfigured");
  });
});
