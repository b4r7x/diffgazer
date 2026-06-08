/**
 * @vitest-environment jsdom
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Result } from "../../result.js";
import { err, ok } from "../../result.js";
import type { StreamReviewError } from "../../review/index.js";
import { ReviewErrorCode } from "../../schemas/review/index.js";
import { requirePromise, requireValue } from "../../testing/assertions.js";
import type { BoundApi } from "../bound.js";
import type { ResumeReviewResult } from "../review.js";
import { ApiProvider } from "./context.js";
import { useReviewStream } from "./use-review-stream.js";

function fakeResumeResult(reviewId = "r"): ResumeReviewResult {
  return { result: { summary: "", issues: [] }, reviewId };
}

function createApi(overrides: Partial<BoundApi> = {}): BoundApi {
  return {
    resumeReviewStream: vi.fn(),
    createReview: vi.fn(),
    ...overrides,
  } as unknown as BoundApi;
}

function createWrapper(api: BoundApi) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(ApiProvider, { value: api }, children);
  };
}

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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
    expect(cancelReviewSession).toHaveBeenCalledWith("cancel-review");

    await act(async () => {
      resolveResume(ok(fakeResumeResult("cancel-review")));
      await requirePromise(resumePromise, "cancel resume promise");
    });
  });

  it("cancel() surfaces server cancellation failure as state.error", async () => {
    let resolveResume: (result: Result<ResumeReviewResult, StreamReviewError>) => void = () => {};
    const resumeReviewStream = vi.fn<BoundApi["resumeReviewStream"]>().mockReturnValue(
      new Promise((resolve) => {
        resolveResume = resolve;
      }),
    );
    const cancelReviewSession = vi.fn().mockResolvedValue({ cancelled: false });
    const api = createApi({ resumeReviewStream, cancelReviewSession });

    const { result } = renderHook(() => useReviewStream(), {
      wrapper: createWrapper(api),
    });

    let resumePromise: Promise<Result<void, StreamReviewError>> | undefined;
    act(() => {
      resumePromise = result.current.resume("cancel-failed-review");
    });

    await waitFor(() => expect(result.current.state.isStreaming).toBe(true));

    await act(async () => {
      await result.current.cancel("cancel-failed-review");
    });

    expect(result.current.state.error).toBe("Failed to cancel the review session on the server.");

    await act(async () => {
      resolveResume(ok(fakeResumeResult("cancel-failed-review")));
      await requirePromise(resumePromise, "cancel failed resume promise");
    });
  });

  it("does not let a stale cancel failure overwrite a newer resumed stream", async () => {
    const firstResume = createDeferred<Result<ResumeReviewResult, StreamReviewError>>();
    const secondResume = createDeferred<Result<ResumeReviewResult, StreamReviewError>>();
    const cancelResult = createDeferred<{ cancelled: boolean }>();
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
      cancelResult.resolve({ cancelled: false });
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

    await act(async () => {
      await result.current.cancel("cancel-throws-review");
    });

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

    act(() => {
      result.current.cancel(null);
    });

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
});
