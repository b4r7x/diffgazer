/**
 * @vitest-environment jsdom
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Result } from "../../result.js";
import { err, ok } from "../../result.js";
import type { StreamReviewError } from "../../review/index.js";
import { ReviewErrorCode } from "../../schemas/review/index.js";
import { requirePromise, requireValue } from "../../testing/assertions.js";
import { createDeferred } from "../../testing/deferred.js";
import { createTestQueryWrapper } from "../../testing/query-wrapper.js";
import type { BoundApi } from "../bound.js";
import type { ResumeReviewResult } from "../review.js";
import { useReviewStream } from "./use-review-stream.js";

function fakeResumeResult(reviewId = "r"): ResumeReviewResult {
  return { result: { issues: [] }, reviewId };
}

function createApi(overrides: Partial<BoundApi> = {}): BoundApi {
  return {
    resumeReviewStream: vi.fn(),
    createReview: vi.fn(),
    ...overrides,
  } as unknown as BoundApi;
}

function createWrapper(api: BoundApi) {
  return createTestQueryWrapper({ api }).Wrapper;
}

describe("useReviewStream", () => {
  it("exposes a resumed review id before the stream returns", async () => {
    let resolveResume: (result: Result<ResumeReviewResult, StreamReviewError>) => void = () => {};
    const resumeReviewStream = vi.fn<BoundApi["resumeReviewStream"]>().mockReturnValue(
      new Promise((resolve) => {
        resolveResume = resolve;
      }),
    );
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
      resolveResume(ok(fakeResumeResult("active-review")));
      await resumePromise;
    });

    expect(resumeReviewStream).toHaveBeenCalledWith(
      expect.objectContaining({ reviewId: "active-review" }),
    );
  });

  it("stop() halts streaming while preserving the active review id", async () => {
    let resolveResume: (result: Result<ResumeReviewResult, StreamReviewError>) => void = () => {};
    const resumeReviewStream = vi.fn<BoundApi["resumeReviewStream"]>().mockReturnValue(
      new Promise((resolve) => {
        resolveResume = resolve;
      }),
    );
    const api = createApi({ resumeReviewStream });

    const { result } = renderHook(() => useReviewStream(), {
      wrapper: createWrapper(api),
    });

    let resumePromise: Promise<Result<void, StreamReviewError>>;
    act(() => {
      resumePromise = result.current.resume("stop-review");
    });

    await waitFor(() => expect(result.current.state.isStreaming).toBe(true));

    act(() => {
      result.current.stop();
    });

    expect(result.current.state.isStreaming).toBe(false);
    expect(result.current.state.reviewId).toBe("stop-review");

    await act(async () => {
      resolveResume(ok(fakeResumeResult("stop-review")));
      await requirePromise(resumePromise, "stop resume promise");
    });
  });

  it("abort() clears the review id and halts streaming", async () => {
    let resolveResume: (result: Result<ResumeReviewResult, StreamReviewError>) => void = () => {};
    const resumeReviewStream = vi.fn<BoundApi["resumeReviewStream"]>().mockReturnValue(
      new Promise((resolve) => {
        resolveResume = resolve;
      }),
    );
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
      resolveResume(ok(fakeResumeResult("abort-review")));
      await requirePromise(resumePromise, "abort resume promise");
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
    let resolveFirst: (result: Result<ResumeReviewResult, StreamReviewError>) => void = () => {};
    let resolveSecond: (result: Result<ResumeReviewResult, StreamReviewError>) => void = () => {};
    const resumeReviewStream = vi
      .fn<BoundApi["resumeReviewStream"]>()
      .mockReturnValueOnce(
        new Promise((r) => {
          resolveFirst = r;
        }),
      )
      .mockReturnValueOnce(
        new Promise((r) => {
          resolveSecond = r;
        }),
      );
    const api = createApi({ resumeReviewStream });

    const { result } = renderHook(() => useReviewStream(), {
      wrapper: createWrapper(api),
    });

    // Start first resume
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
    // subsequent stop() would have nothing to abort.
    await act(async () => {
      resolveFirst(ok(fakeResumeResult("first-review")));
      await requirePromise(firstPromise, "first resume promise");
    });

    // The second stream can still be stopped (controller ref not nulled)
    act(() => {
      result.current.stop();
    });
    expect(result.current.state.isStreaming).toBe(false);

    await act(async () => {
      resolveSecond(ok(fakeResumeResult("second-review")));
      await requirePromise(secondPromise, "second resume promise");
    });
  });

  it("cancel() halts streaming and calls cancelReviewSession on the server", async () => {
    let resolveResume: (result: Result<ResumeReviewResult, StreamReviewError>) => void = () => {};
    const resumeReviewStream = vi.fn<BoundApi["resumeReviewStream"]>().mockReturnValue(
      new Promise((resolve) => {
        resolveResume = resolve;
      }),
    );
    const cancelReviewSession = vi.fn().mockResolvedValue({ cancelled: true });
    const api = createApi({ resumeReviewStream, cancelReviewSession });

    const { result } = renderHook(() => useReviewStream(), {
      wrapper: createWrapper(api),
    });

    let resumePromise: Promise<Result<void, StreamReviewError>> | undefined;
    act(() => {
      resumePromise = result.current.resume("cancel-review");
    });

    await waitFor(() => expect(result.current.state.isStreaming).toBe(true));

    act(() => {
      result.current.cancel("cancel-review");
    });

    expect(result.current.state.isStreaming).toBe(false);
    expect(result.current.state.errorCode).toBe(ReviewErrorCode.CANCELLED);
    expect(cancelReviewSession).toHaveBeenCalledWith("cancel-review");

    await act(async () => {
      resolveResume(ok(fakeResumeResult("cancel-review")));
      await requirePromise(resumePromise, "cancel resume promise");
    });
  });

  it("cancel(reviewId, { preserveState: true }) invokes the server cancel without resetting stream state", async () => {
    let resolveResume: (result: Result<ResumeReviewResult, StreamReviewError>) => void = () => {};
    const resumeReviewStream = vi.fn<BoundApi["resumeReviewStream"]>().mockReturnValue(
      new Promise((resolve) => {
        resolveResume = resolve;
      }),
    );
    const cancelReviewSession = vi.fn().mockResolvedValue({ cancelled: true });
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
    expect(result.current.state.isStreaming).toBe(true);
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.notices).toEqual([]);
    expect(cancelReviewSession).toHaveBeenCalledWith("preserve-review");

    await act(async () => {
      resolveResume(ok(fakeResumeResult("preserve-review")));
      await requirePromise(resumePromise, "preserve-state cancel resume promise");
    });
  });

  it("treats a terminal/absent session cancel as success without an error", async () => {
    let resolveResume: (result: Result<ResumeReviewResult, StreamReviewError>) => void = () => {};
    const resumeReviewStream = vi.fn<BoundApi["resumeReviewStream"]>().mockReturnValue(
      new Promise((resolve) => {
        resolveResume = resolve;
      }),
    );
    const cancelReviewSession = vi
      .fn()
      .mockResolvedValue({ cancelled: true, reason: "already-complete" });
    const api = createApi({ resumeReviewStream, cancelReviewSession });

    const { result } = renderHook(() => useReviewStream(), {
      wrapper: createWrapper(api),
    });

    let resumePromise: Promise<Result<void, StreamReviewError>> | undefined;
    act(() => {
      resumePromise = result.current.resume("cancel-terminal-review");
    });

    await waitFor(() => expect(result.current.state.isStreaming).toBe(true));

    let cancelError: string | null | undefined;
    await act(async () => {
      cancelError = await result.current.cancel("cancel-terminal-review");
    });

    expect(cancelError).toBeNull();
    expect(result.current.state.error).toBeNull();

    await act(async () => {
      resolveResume(ok(fakeResumeResult("cancel-terminal-review")));
      await requirePromise(resumePromise, "cancel terminal resume promise");
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

    let cancelPromise: Promise<string | null> | undefined;
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
      await requirePromise(cancelPromise, "stale cancel promise");
    });

    expect(result.current.state.reviewId).toBe("second-review");
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.isStreaming).toBe(true);

    await act(async () => {
      firstResume.resolve(ok(fakeResumeResult("first-review")));
      await requirePromise(firstPromise, "first resume promise");
    });
    await act(async () => {
      secondResume.resolve(ok(fakeResumeResult("second-review")));
      await requirePromise(secondPromise, "second resume promise");
    });
  });

  it("cancel() surfaces thrown server errors as state.error", async () => {
    let resolveResume: (result: Result<ResumeReviewResult, StreamReviewError>) => void = () => {};
    const resumeReviewStream = vi.fn<BoundApi["resumeReviewStream"]>().mockReturnValue(
      new Promise((resolve) => {
        resolveResume = resolve;
      }),
    );
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

    let cancelError: string | null | undefined;
    await act(async () => {
      cancelError = await result.current.cancel("cancel-throws-review");
    });

    expect(cancelError).toBe("cancel endpoint down");
    expect(result.current.state.error).toBe("cancel endpoint down");

    await act(async () => {
      resolveResume(ok(fakeResumeResult("cancel-throws-review")));
      await requirePromise(resumePromise, "cancel throws resume promise");
    });
  });

  it("cancel() with null reviewId skips the server call", async () => {
    const cancelReviewSession = vi.fn().mockResolvedValue({ cancelled: true });
    const api = createApi({ cancelReviewSession });

    const { result } = renderHook(() => useReviewStream(), {
      wrapper: createWrapper(api),
    });

    let cancelResult: string | null | undefined;
    await act(async () => {
      cancelResult = await result.current.cancel(null);
    });

    expect(cancelResult).toBeNull();
    expect(cancelReviewSession).not.toHaveBeenCalled();
  });

  it("returns SESSION_STALE to the caller without surfacing it as a stream error", async () => {
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

    expect(result.current.state.error).toBeNull();
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
          // Emit the cap warning mid-stream, then complete.
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

  it.each([
    "online",
    "visibilitychange",
  ] as const)("reconnects an active review after a transport drop on %s", async (browserEvent) => {
    const streamError: StreamReviewError = {
      code: "STREAM_ERROR",
      message: "connection dropped",
    };
    const resumeReviewStream = vi
      .fn<BoundApi["resumeReviewStream"]>()
      .mockResolvedValueOnce(err(streamError))
      .mockResolvedValueOnce(ok(fakeResumeResult("active-review")));
    const api = createApi({ resumeReviewStream });
    const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    try {
      const { result } = renderHook(() => useReviewStream(), {
        wrapper: createWrapper(api),
      });

      await act(async () => {
        await result.current.resume("active-review");
      });
      expect(result.current.state.errorCode).toBe("STREAM_ERROR");

      act(() => {
        const target = browserEvent === "online" ? window : document;
        target.dispatchEvent(new Event(browserEvent));
      });

      await waitFor(() => expect(resumeReviewStream).toHaveBeenCalledTimes(2));
      expect(resumeReviewStream).toHaveBeenLastCalledWith(
        expect.objectContaining({ reviewId: "active-review" }),
      );
    } finally {
      if (visibilityDescriptor) {
        Object.defineProperty(document, "visibilityState", visibilityDescriptor);
      }
    }
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

  it("removes reconnect listeners when the stream hook unmounts", async () => {
    const streamError: StreamReviewError = {
      code: "STREAM_ERROR",
      message: "connection dropped",
    };
    const resumeReviewStream = vi
      .fn<BoundApi["resumeReviewStream"]>()
      .mockResolvedValue(err(streamError));
    const api = createApi({ resumeReviewStream });
    const { result, unmount } = renderHook(() => useReviewStream(), {
      wrapper: createWrapper(api),
    });

    await act(async () => {
      await result.current.resume("active-review");
    });
    unmount();
    act(() => window.dispatchEvent(new Event("online")));

    expect(resumeReviewStream).toHaveBeenCalledTimes(1);
  });
});
