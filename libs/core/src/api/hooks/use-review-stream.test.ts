/**
 * @vitest-environment jsdom
 */
import { createElement, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BoundApi } from "../bound.js";
import { ApiProvider } from "./context.js";
import { useReviewStream } from "./use-review-stream.js";
import type { Result } from "@diffgazer/core/result";
import { ok, err } from "@diffgazer/core/result";
import type { StreamReviewError } from "@diffgazer/core/review";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";

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

describe("useReviewStream", () => {
  it("exposes a resumed review id before the stream returns", async () => {
    let resolveResume: (result: Result<void, StreamReviewError>) => void = () => {};
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
      resumePromise = result.current.resume("active-review");
    });

    await waitFor(() => expect(result.current.state.reviewId).toBe("active-review"));
    expect(result.current.state.isStreaming).toBe(true);

    await act(async () => {
      resolveResume(ok(undefined));
      await resumePromise;
    });

    expect(resumeReviewStream).toHaveBeenCalledWith(
      expect.objectContaining({ reviewId: "active-review" }),
    );
  });

  it("stop() halts streaming while preserving the active review id", async () => {
    let resolveResume: (result: Result<void, StreamReviewError>) => void = () => {};
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
      resolveResume(ok(undefined));
      await resumePromise!;
    });
  });

  it("abort() clears the review id and halts streaming", async () => {
    let resolveResume: (result: Result<void, StreamReviewError>) => void = () => {};
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
      resumePromise = result.current.resume("abort-review");
    });

    await waitFor(() => expect(result.current.state.isStreaming).toBe(true));

    act(() => {
      result.current.abort();
    });

    expect(result.current.state.isStreaming).toBe(false);
    expect(result.current.state.reviewId).toBeNull();

    await act(async () => {
      resolveResume(ok(undefined));
      await resumePromise!;
    });
  });

  it("surfaces a non-abort stream rejection as state.error and halts streaming", async () => {
    const resumeReviewStream = vi.fn<BoundApi["resumeReviewStream"]>().mockRejectedValue(
      new Error("network failure"),
    );
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
    let resolveFirst: (result: Result<void, StreamReviewError>) => void = () => {};
    let resolveSecond: (result: Result<void, StreamReviewError>) => void = () => {};
    const resumeReviewStream = vi.fn<BoundApi["resumeReviewStream"]>()
      .mockReturnValueOnce(new Promise((r) => { resolveFirst = r; }))
      .mockReturnValueOnce(new Promise((r) => { resolveSecond = r; }));
    const api = createApi({ resumeReviewStream });

    const { result } = renderHook(() => useReviewStream(), {
      wrapper: createWrapper(api),
    });

    // Start first resume
    let firstPromise: Promise<Result<void, StreamReviewError>>;
    act(() => {
      firstPromise = result.current.resume("first-review");
    });

    await waitFor(() => expect(result.current.state.isStreaming).toBe(true));

    // Start second resume (cancels first internally)
    let secondPromise: Promise<Result<void, StreamReviewError>>;
    act(() => {
      secondPromise = result.current.resume("second-review");
    });

    await waitFor(() => expect(result.current.state.reviewId).toBe("second-review"));

    // Resolve the first (aborted) -- the finally guard should NOT null the
    // second's controller. Before the fix, this would null the ref and a
    // subsequent stop() would have nothing to abort.
    await act(async () => {
      resolveFirst(ok(undefined));
      await firstPromise!;
    });

    // The second stream can still be stopped (controller ref not nulled)
    act(() => {
      result.current.stop();
    });
    expect(result.current.state.isStreaming).toBe(false);

    await act(async () => {
      resolveSecond(ok(undefined));
      await secondPromise!;
    });
  });

  it("cancel() halts streaming and calls cancelReviewSession on the server", async () => {
    let resolveResume: (result: Result<void, StreamReviewError>) => void = () => {};
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

    let resumePromise: Promise<Result<void, StreamReviewError>>;
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
      resolveResume(ok(undefined));
      await resumePromise!;
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
    const resumeReviewStream = vi.fn<BoundApi["resumeReviewStream"]>().mockResolvedValue(
      err(staleError),
    );
    const api = createApi({ resumeReviewStream });

    const { result } = renderHook(() => useReviewStream(), {
      wrapper: createWrapper(api),
    });

    let returnedResult: Result<void, StreamReviewError>;
    await act(async () => {
      returnedResult = await result.current.resume("stale-review");
    });

    expect(result.current.state.error).toBeNull();
    expect(returnedResult!.ok).toBe(false);
    if (!returnedResult!.ok) {
      expect(returnedResult!.error.code).toBe(ReviewErrorCode.SESSION_STALE);
    }
  });
});
