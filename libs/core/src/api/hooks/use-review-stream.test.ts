/**
 * @vitest-environment jsdom
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Result } from "../../result.js";
import { err, ok } from "../../result.js";
import type { StreamReviewError } from "../../review/index.js";
import { ReviewErrorCode } from "../../schemas/review/index.js";
import { requireValue } from "../../testing/assertions.js";
import { createDeferred } from "../../testing/deferred.js";
import { createTestQueryWrapper } from "../../testing/query-wrapper.js";
import type { BoundApi } from "../bound.js";
import type { CancelReason, ResumeReviewResult } from "../review.js";
import { type CancelReviewOutcome, useReviewStream } from "./use-review-stream.js";

function fakeResumeResult(reviewId = "r"): ResumeReviewResult {
  return { result: { issues: [] }, reviewId };
}

function createApi(overrides: Partial<BoundApi> = {}): Partial<BoundApi> {
  return {
    resumeReviewStream: vi.fn(),
    ...overrides,
  };
}

function createWrapper(api: Partial<BoundApi>) {
  return createTestQueryWrapper({ api }).Wrapper;
}

describe("useReviewStream", () => {
  it("exposes a resumed review id before the stream returns", async () => {
    const resumeDeferred = createDeferred<Result<ResumeReviewResult, StreamReviewError>>();
    const resumeReviewStream = vi
      .fn<BoundApi["resumeReviewStream"]>()
      .mockReturnValue(resumeDeferred.promise);
    const api = createApi({ resumeReviewStream });

    const { result } = renderHook(() => useReviewStream(), {
      wrapper: createWrapper(api),
    });

    let resumePromise: Promise<Result<void, StreamReviewError>> | undefined;
    act(() => {
      resumePromise = result.current.resume("active-review");
    });

    await waitFor(() => expect(result.current.state.reviewId).toBe("active-review"));
    expect(result.current.state.isStreaming).toBe(true);

    await act(async () => {
      resumeDeferred.resolve(ok(fakeResumeResult("active-review")));
      await resumePromise;
    });

    expect(resumeReviewStream).toHaveBeenCalledWith(
      expect.objectContaining({ reviewId: "active-review" }),
    );
  });

  it("abort() clears the review id and halts streaming", async () => {
    const resumeDeferred = createDeferred<Result<ResumeReviewResult, StreamReviewError>>();
    const resumeReviewStream = vi
      .fn<BoundApi["resumeReviewStream"]>()
      .mockReturnValue(resumeDeferred.promise);
    const api = createApi({ resumeReviewStream });

    const { result } = renderHook(() => useReviewStream(), {
      wrapper: createWrapper(api),
    });

    let resumePromise: Promise<Result<void, StreamReviewError>> | undefined;
    act(() => {
      resumePromise = result.current.resume("abort-review");
    });

    await waitFor(() => expect(result.current.state.isStreaming).toBe(true));

    act(() => {
      result.current.abort();
    });

    expect(result.current.state.isStreaming).toBe(false);
    expect(result.current.state.reviewId).toBeNull();

    await act(async () => {
      resumeDeferred.resolve(ok(fakeResumeResult("abort-review")));
      await requireValue(resumePromise, "abort resume promise");
    });
  });

  it("surfaces a non-abort stream rejection as state.error and halts streaming", async () => {
    const resumeReviewStream = vi
      .fn<BoundApi["resumeReviewStream"]>()
      .mockRejectedValue(new Error("network failure"));
    const api = createApi({ resumeReviewStream });

    const { result } = renderHook(() => useReviewStream(), {
      wrapper: createWrapper(api),
    });

    await act(async () => {
      await result.current.resume("error-review");
    });

    expect(result.current.state.error).toBe("network failure");
    expect(result.current.state.errorCode).toBe("STREAM_ERROR");
    expect(result.current.state.isStreaming).toBe(false);
  });

  it("older resume finishing does not null the newer controller ref", async () => {
    const firstResume = createDeferred<Result<ResumeReviewResult, StreamReviewError>>();
    const secondResume = createDeferred<Result<ResumeReviewResult, StreamReviewError>>();
    const resumeReviewStream = vi
      .fn<BoundApi["resumeReviewStream"]>()
      .mockReturnValueOnce(firstResume.promise)
      .mockImplementationOnce((options) => {
        secondSignal = options.signal;
        return secondResume.promise;
      });
    const api = createApi({ resumeReviewStream });

    const { result } = renderHook(() => useReviewStream(), {
      wrapper: createWrapper(api),
    });

    let secondSignal: AbortSignal | undefined;

    let firstPromise: Promise<Result<void, StreamReviewError>> | undefined;
    act(() => {
      firstPromise = result.current.resume("first-review");
    });

    await waitFor(() => expect(result.current.state.isStreaming).toBe(true));

    // Start second resume (cancels first internally)
    let secondPromise: Promise<Result<void, StreamReviewError>> | undefined;
    act(() => {
      secondPromise = result.current.resume("second-review");
    });

    await waitFor(() => expect(result.current.state.reviewId).toBe("second-review"));

    // Resolve the first (aborted) -- the finally guard should NOT null the
    // second's controller. Before the fix, this would null the ref and a
    // subsequent abort would have nothing to abort.
    await act(async () => {
      firstResume.resolve(ok(fakeResumeResult("first-review")));
      await requireValue(firstPromise, "first resume promise");
    });

    expect(secondSignal).toBeDefined();
    expect(secondSignal?.aborted).toBe(false);

    // The second stream can still be aborted (controller ref not nulled)
    act(() => {
      result.current.abort();
    });
    expect(secondSignal?.aborted).toBe(true);
    expect(result.current.state.isStreaming).toBe(false);

    await act(async () => {
      secondResume.resolve(ok(fakeResumeResult("second-review")));
      await requireValue(secondPromise, "second resume promise");
    });
  });

  it("cancel() halts streaming and calls cancelReviewSession on the server", async () => {
    const resumeDeferred = createDeferred<Result<ResumeReviewResult, StreamReviewError>>();
    const resumeReviewStream = vi
      .fn<BoundApi["resumeReviewStream"]>()
      .mockReturnValue(resumeDeferred.promise);
    const cancelReviewSession = vi
      .fn()
      .mockResolvedValue({ cancelled: true, reason: "cancelled" as const });
    const api = createApi({ resumeReviewStream, cancelReviewSession });

    const { result } = renderHook(() => useReviewStream(), {
      wrapper: createWrapper(api),
    });

    let resumePromise: Promise<Result<void, StreamReviewError>> | undefined;
    act(() => {
      resumePromise = result.current.resume("cancel-review");
    });

    await waitFor(() => expect(result.current.state.isStreaming).toBe(true));

    await act(async () => {
      const outcome = await result.current.cancel("cancel-review");
      expect(outcome).toEqual({ status: "cancelled", reason: "cancelled" });
    });

    expect(result.current.state.isStreaming).toBe(false);
    expect(result.current.state.errorCode).toBe(ReviewErrorCode.CANCELLED);
    expect(cancelReviewSession).toHaveBeenCalledWith("cancel-review");

    await act(async () => {
      resumeDeferred.resolve(ok(fakeResumeResult("cancel-review")));
      await requireValue(resumePromise, "cancel resume promise");
    });
  });

  it("cancel(reviewId, { preserveState: true }) invokes the server cancel without resetting stream state", async () => {
    const resumeDeferred = createDeferred<Result<ResumeReviewResult, StreamReviewError>>();
    const resumeReviewStream = vi
      .fn<BoundApi["resumeReviewStream"]>()
      .mockReturnValue(resumeDeferred.promise);
    const cancelReviewSession = vi
      .fn()
      .mockResolvedValue({ cancelled: true, reason: "cancelled" as const });
    const api = createApi({ resumeReviewStream, cancelReviewSession });

    const { result } = renderHook(() => useReviewStream(), {
      wrapper: createWrapper(api),
    });

    let resumePromise: Promise<Result<void, StreamReviewError>> | undefined;
    act(() => {
      resumePromise = result.current.resume("preserve-review");
    });

    await waitFor(() => expect(result.current.state.isStreaming).toBe(true));

    await act(async () => {
      await result.current.cancel("preserve-review", { preserveState: true });
    });

    expect(result.current.state.reviewId).toBe("preserve-review");
    expect(result.current.state.isStreaming).toBe(false);
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.notices).toEqual([]);
    expect(cancelReviewSession).toHaveBeenCalledWith("preserve-review");

    await act(async () => {
      resumeDeferred.resolve(ok(fakeResumeResult("preserve-review")));
      await requireValue(resumePromise, "preserve-state cancel resume promise");
    });
  });

  it.each([
    ["cancelled" as const, ReviewErrorCode.CANCELLED],
    ["not-found" as const, ReviewErrorCode.CANCELLED],
    ["already-complete" as const, null],
    ["already-committed" as const, null],
  ])("stops streaming after a %s cancel without reporting an error", async (reason, errorCode) => {
    const resumeDeferred = createDeferred<Result<ResumeReviewResult, StreamReviewError>>();
    const resumeReviewStream = vi
      .fn<BoundApi["resumeReviewStream"]>()
      .mockReturnValue(resumeDeferred.promise);
    const cancelReviewSession = vi.fn().mockResolvedValue({ cancelled: true, reason });
    const api = createApi({ resumeReviewStream, cancelReviewSession });

    const { result } = renderHook(() => useReviewStream(), {
      wrapper: createWrapper(api),
    });

    let resumePromise: Promise<Result<void, StreamReviewError>> | undefined;
    act(() => {
      resumePromise = result.current.resume("cancel-terminal-review");
    });

    await waitFor(() => expect(result.current.state.isStreaming).toBe(true));

    let cancelOutcome: CancelReviewOutcome | null | undefined;
    await act(async () => {
      cancelOutcome = await result.current.cancel("cancel-terminal-review");
    });

    expect(cancelOutcome).toEqual({ status: "cancelled", reason });
    expect(result.current.state.isStreaming).toBe(false);
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.errorCode).toBe(errorCode);

    await act(async () => {
      resumeDeferred.resolve(ok(fakeResumeResult("cancel-terminal-review")));
      await requireValue(resumePromise, "cancel terminal resume promise");
    });
  });

  it("does not let a stale cancel failure overwrite a newer resumed stream", async () => {
    const firstResume = createDeferred<Result<ResumeReviewResult, StreamReviewError>>();
    const secondResume = createDeferred<Result<ResumeReviewResult, StreamReviewError>>();
    const cancelResult = createDeferred<never>();
    const resumeReviewStream = vi
      .fn<BoundApi["resumeReviewStream"]>()
      .mockReturnValueOnce(firstResume.promise)
      .mockReturnValueOnce(secondResume.promise);
    const cancelReviewSession = vi.fn().mockReturnValue(cancelResult.promise);
    const api = createApi({ resumeReviewStream, cancelReviewSession });

    const { result } = renderHook(() => useReviewStream(), {
      wrapper: createWrapper(api),
    });

    let firstPromise: Promise<Result<void, StreamReviewError>> | undefined;
    act(() => {
      firstPromise = result.current.resume("first-review");
    });

    await waitFor(() => expect(result.current.state.reviewId).toBe("first-review"));

    let cancelPromise: Promise<CancelReviewOutcome | null> | undefined;
    act(() => {
      cancelPromise = result.current.cancel("first-review");
    });

    let secondPromise: Promise<Result<void, StreamReviewError>> | undefined;
    act(() => {
      secondPromise = result.current.resume("second-review");
    });

    await waitFor(() => expect(result.current.state.reviewId).toBe("second-review"));

    await act(async () => {
      cancelResult.reject(new Error("cancel endpoint down"));
      await requireValue(cancelPromise, "stale cancel promise");
    });

    expect(result.current.state.reviewId).toBe("second-review");
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.isStreaming).toBe(true);

    await act(async () => {
      firstResume.resolve(ok(fakeResumeResult("first-review")));
      await requireValue(firstPromise, "first resume promise");
    });
    await act(async () => {
      secondResume.resolve(ok(fakeResumeResult("second-review")));
      await requireValue(secondPromise, "second resume promise");
    });
  });

  it("does not let a stale cancel confirmation stop a newer resumed stream", async () => {
    const firstResume = createDeferred<Result<ResumeReviewResult, StreamReviewError>>();
    const secondResume = createDeferred<Result<ResumeReviewResult, StreamReviewError>>();
    const cancelResult = createDeferred<{ cancelled: boolean; reason: CancelReason }>();
    const resumeReviewStream = vi
      .fn<BoundApi["resumeReviewStream"]>()
      .mockReturnValueOnce(firstResume.promise)
      .mockReturnValueOnce(secondResume.promise);
    const cancelReviewSession = vi.fn().mockReturnValue(cancelResult.promise);
    const api = createApi({ resumeReviewStream, cancelReviewSession });

    const { result } = renderHook(() => useReviewStream(), {
      wrapper: createWrapper(api),
    });

    let firstPromise: Promise<Result<void, StreamReviewError>> | undefined;
    act(() => {
      firstPromise = result.current.resume("first-review");
    });

    await waitFor(() => expect(result.current.state.reviewId).toBe("first-review"));

    let cancelPromise: Promise<CancelReviewOutcome | null> | undefined;
    act(() => {
      cancelPromise = result.current.cancel("first-review");
    });

    let secondPromise: Promise<Result<void, StreamReviewError>> | undefined;
    act(() => {
      secondPromise = result.current.resume("second-review");
    });

    await waitFor(() => expect(result.current.state.reviewId).toBe("second-review"));

    await act(async () => {
      cancelResult.resolve({ cancelled: true, reason: "cancelled" });
      await requireValue(cancelPromise, "stale cancel confirmation promise");
    });

    expect(result.current.state.reviewId).toBe("second-review");
    expect(result.current.state.isStreaming).toBe(true);
    expect(result.current.state.errorCode).toBeNull();

    await act(async () => {
      firstResume.resolve(ok(fakeResumeResult("first-review")));
      await requireValue(firstPromise, "first resume promise");
    });
    await act(async () => {
      secondResume.resolve(ok(fakeResumeResult("second-review")));
      await requireValue(secondPromise, "second resume promise");
    });
  });

  it("cancel() surfaces thrown server errors as state.error", async () => {
    const resumeDeferred = createDeferred<Result<ResumeReviewResult, StreamReviewError>>();
    const resumeReviewStream = vi
      .fn<BoundApi["resumeReviewStream"]>()
      .mockReturnValue(resumeDeferred.promise);
    const cancelReviewSession = vi.fn().mockRejectedValue(new Error("cancel endpoint down"));
    const api = createApi({ resumeReviewStream, cancelReviewSession });

    const { result } = renderHook(() => useReviewStream(), {
      wrapper: createWrapper(api),
    });

    let resumePromise: Promise<Result<void, StreamReviewError>> | undefined;
    act(() => {
      resumePromise = result.current.resume("cancel-throws-review");
    });

    await waitFor(() => expect(result.current.state.isStreaming).toBe(true));

    let cancelOutcome: CancelReviewOutcome | null | undefined;
    await act(async () => {
      cancelOutcome = await result.current.cancel("cancel-throws-review");
    });

    expect(cancelOutcome).toEqual({ status: "error", message: "cancel endpoint down" });
    expect(result.current.state.error).toBe("cancel endpoint down");

    await act(async () => {
      resumeDeferred.resolve(ok(fakeResumeResult("cancel-throws-review")));
      await requireValue(resumePromise, "cancel throws resume promise");
    });
  });

  it("cancel() with null reviewId skips the server call", async () => {
    const cancelReviewSession = vi.fn().mockResolvedValue({ cancelled: true });
    const api = createApi({ cancelReviewSession });

    const { result } = renderHook(() => useReviewStream(), {
      wrapper: createWrapper(api),
    });

    let cancelOutcome: CancelReviewOutcome | null | undefined;
    await act(async () => {
      cancelOutcome = await result.current.cancel(null);
    });

    expect(cancelOutcome).toEqual({ status: "cancelled", reason: "cancelled" });
    expect(cancelReviewSession).not.toHaveBeenCalled();
  });

  it("returns SESSION_STALE to the caller and retains the terminal error in stream state", async () => {
    const staleError: StreamReviewError = {
      code: ReviewErrorCode.SESSION_STALE,
      message: "stale",
    };
    const resumeReviewStream = vi
      .fn<BoundApi["resumeReviewStream"]>()
      .mockResolvedValue(err(staleError));
    const api = createApi({ resumeReviewStream });

    const { result } = renderHook(() => useReviewStream(), {
      wrapper: createWrapper(api),
    });

    let returnedResult: Result<void, StreamReviewError> | undefined;
    await act(async () => {
      returnedResult = await result.current.resume("stale-review");
    });

    expect(result.current.state.error).toBe("stale");
    expect(result.current.state.errorCode).toBe(ReviewErrorCode.SESSION_STALE);
    expect(result.current.state.isStreaming).toBe(false);
    const resumeResult = requireValue(returnedResult, "resume result");
    expect(resumeResult.ok).toBe(false);
    if (!resumeResult.ok) {
      expect(resumeResult.error.code).toBe(ReviewErrorCode.SESSION_STALE);
    }
  });

  it("preserves structured review error codes on stream errors", async () => {
    const noDiffError: StreamReviewError = {
      code: ReviewErrorCode.NO_DIFF,
      message: "No staged changes found.",
    };
    const resumeReviewStream = vi
      .fn<BoundApi["resumeReviewStream"]>()
      .mockResolvedValue(err(noDiffError));
    const api = createApi({ resumeReviewStream });

    const { result } = renderHook(() => useReviewStream(), {
      wrapper: createWrapper(api),
    });

    let returnedResult: Result<void, StreamReviewError> | undefined;
    await act(async () => {
      returnedResult = await result.current.resume("no-diff-review");
    });

    expect(result.current.state.error).toBe("No staged changes found.");
    expect(result.current.state.errorCode).toBe(ReviewErrorCode.NO_DIFF);
    expect(result.current.state.isStreaming).toBe(false);
    const resumeResult = requireValue(returnedResult, "resume result");
    expect(resumeResult.ok).toBe(false);
    if (!resumeResult.ok) {
      expect(resumeResult.error.code).toBe(ReviewErrorCode.NO_DIFF);
    }
  });

  it("surfaces a streamed cap-warning chunk as a user-visible notice", async () => {
    const resumeReviewStream = vi.fn<BoundApi["resumeReviewStream"]>().mockImplementation(
      (options) =>
        new Promise((resolve) => {
          options.onChunk?.("Event cap reached; some progress events were dropped.");
          resolve(ok(fakeResumeResult("noticed-review")));
        }),
    );
    const api = createApi({ resumeReviewStream });

    const { result } = renderHook(() => useReviewStream(), {
      wrapper: createWrapper(api),
    });

    await act(async () => {
      await result.current.resume("noticed-review");
    });

    expect(result.current.state.notices).toContain(
      "Event cap reached; some progress events were dropped.",
    );
  });

  it("ignores events from a superseded resume after a newer resume starts", async () => {
    let firstOnStepEvent:
      | ((
          event: Parameters<
            NonNullable<Parameters<BoundApi["resumeReviewStream"]>[0]["onStepEvent"]>
          >[0],
        ) => void)
      | undefined;
    let secondOnStepEvent:
      | ((
          event: Parameters<
            NonNullable<Parameters<BoundApi["resumeReviewStream"]>[0]["onStepEvent"]>
          >[0],
        ) => void)
      | undefined;
    const resumeReviewStream = vi
      .fn<BoundApi["resumeReviewStream"]>()
      .mockImplementationOnce((options) => {
        firstOnStepEvent = options.onStepEvent;
        return new Promise(() => {});
      })
      .mockImplementationOnce((options) => {
        secondOnStepEvent = options.onStepEvent;
        return new Promise(() => {});
      });
    const api = createApi({ resumeReviewStream });

    const { result } = renderHook(() => useReviewStream(), {
      wrapper: createWrapper(api),
    });

    act(() => {
      void result.current.resume("first-review");
    });
    await waitFor(() => expect(result.current.state.reviewId).toBe("first-review"));

    act(() => {
      void result.current.resume("second-review");
    });
    await waitFor(() => expect(result.current.state.reviewId).toBe("second-review"));

    act(() => {
      firstOnStepEvent?.({
        type: "step_complete",
        step: "context",
        timestamp: "2026-07-15T12:00:00.000Z",
      });
    });

    expect(result.current.state.steps.find((step) => step.id === "context")?.status).not.toBe(
      "completed",
    );

    act(() => {
      secondOnStepEvent?.({
        type: "step_complete",
        step: "context",
        timestamp: "2026-07-15T12:00:01.000Z",
      });
    });

    await waitFor(() =>
      expect(result.current.state.steps.find((step) => step.id === "context")?.status).toBe(
        "completed",
      ),
    );
  });

  it("aborts the pending stream boundary signal when the hook unmounts", async () => {
    const deferred = createDeferred<Result<ResumeReviewResult, StreamReviewError>>();
    const resumeReviewStream = vi
      .fn<BoundApi["resumeReviewStream"]>()
      .mockReturnValue(deferred.promise);
    const api = createApi({ resumeReviewStream });

    const { result, unmount } = renderHook(() => useReviewStream(), {
      wrapper: createWrapper(api),
    });

    act(() => {
      void result.current.resume("active-review");
    });

    await waitFor(() => expect(resumeReviewStream).toHaveBeenCalledTimes(1));
    const signal = requireValue(
      resumeReviewStream.mock.calls[0]?.[0]?.signal,
      "resume stream abort signal",
    );
    expect(signal.aborted).toBe(false);

    unmount();

    expect(signal.aborted).toBe(true);
  });
});
